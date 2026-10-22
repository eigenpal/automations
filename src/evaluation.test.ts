import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { compileAgent } from './compiler';
import { createAgent, exactDiff, llmJudge, weightedScore } from './index';

const base = () =>
  createAgent({
    name: 'Invoice',
    outputSchema: z.object({ total: z.number(), summary: z.string() }),
  });
describe('fluent evaluations', () => {
  test('evaluation registration and decisions remain immutable while filesystem capabilities compose', () => {
    const agent = base().withFilesystem({ cwd: null });
    const evaluators = agent.defineEvaluator(
      'fields',
      exactDiff({ select: (out) => ({ total: out.total }) })
    );
    const completed = evaluators.defineEvalPass(({ fields }) => fields === 1);
    expect(agent).not.toHaveProperty('evaluation');
    expect(evaluators.withFilesystem).toBeFunction();
    expect(completed.withFilesystem).toBeFunction();
    expect(completed).not.toHaveProperty('defineEvaluator');
    expect(completed).not.toHaveProperty('defineEvalPass');
    expect(completed.config.workspace?.cwd).toBeNull();
    expect(compileAgent(completed).evaluation).toEqual({
      evaluators: { fields: { kind: 'exact-diff' } },
      pass: { kind: 'callback' },
    });
    expect(Object.isFrozen(completed.evaluation?.evaluators)).toBe(true);
    expect(() => compileAgent(evaluators as never)).toThrow('defineEvalPass');
  });
  test('filesystem extension during registration preserves evaluators and the typed registry', () => {
    const original = base().defineEvaluator('positive', ({ actual }) => (actual.total > 0 ? 1 : 0));
    const filesystem = original.withFilesystem({
      cwd: null,
      files: { 'invoice.txt': 'Subtotal: 100' },
    });
    const completed = filesystem
      .defineEvaluator('summary', ({ actual }) => (actual.summary.length ? 1 : 0))
      .defineEvalPass(({ positive, summary }) => positive === 1 && summary === 1);
    expect(original.config.filesystem).toBeUndefined();
    expect(original.evaluation?.evaluators).toHaveProperty('positive');
    expect(original.evaluation?.evaluators).not.toHaveProperty('summary');
    expect(filesystem.evaluation?.evaluators.positive).toBe(
      original.evaluation?.evaluators.positive
    );
    expect(compileAgent(completed).evaluation).toEqual({
      evaluators: { positive: { kind: 'custom' }, summary: { kind: 'custom' } },
      pass: { kind: 'callback' },
    });
    expect(compileAgent(completed).manifest.workspace?.cwd).toBeNull();
    expect(() => filesystem.defineEvaluator('positive' as never, () => 1)).toThrow('Duplicate');
    expect(() => compileAgent(filesystem as never)).toThrow('defineEvalPass');
  });

  test.each(['callback', 'weighted'] as const)(
    'completed %s evaluations survive filesystem opt-in and replacement',
    (kind) => {
      const registering = base().defineEvaluator('positive', ({ actual }) =>
        actual.total > 0 ? 1 : 0
      );
      const original =
        kind === 'callback'
          ? registering.defineEvalPass(({ positive }) => positive === 1)
          : registering.defineEvalPass(weightedScore({ weights: { positive: 1 }, threshold: 1 }));
      const empty = original.withFilesystem({
        cwd: null,
        files: { 'invoice.txt': 'Subtotal: 100' },
      });
      const repository = empty.withFilesystem();
      expect(compileAgent(original).manifest.filesystem).toBe(false);
      expect(compileAgent(empty).manifest.workspace?.cwd).toBeNull();
      expect(compileAgent(repository).manifest.filesystem).toBe(true);
      expect(compileAgent(repository).manifest).not.toHaveProperty('workspace');
      expect(empty.evaluation?.evaluators.positive).toBe(original.evaluation?.evaluators.positive);
      expect(empty.evaluation?.pass).toBe(original.evaluation?.pass);
      expect(repository.evaluation?.pass).toBe(original.evaluation?.pass);
      expect(compileAgent(empty).evaluation).toEqual(compileAgent(original).evaluation);
      expect(empty.inputSchema).toBe(original.inputSchema);
      expect(empty.outputSchema).toBe(original.outputSchema);
      expect(Object.isFrozen(empty.evaluation?.evaluators)).toBe(true);
      expect(empty).not.toHaveProperty('defineEvaluator');
      expect(empty).not.toHaveProperty('defineEvalPass');
    }
  );

  test('selectors and callbacks remain available to isolated runtime but absent from compiled data', () => {
    const definition = base()
      .defineEvaluator('positive', ({ actual }) => (actual.total >= 0 ? 1 : 0))
      .defineEvaluator(
        'meaning',
        llmJudge({
          prompt: 'Compare the invoice summary.',
          select: ({ actual, expected }) => ({
            actual: actual.summary,
            expected: expected?.summary,
          }),
          model: 'judge-model',
        })
      )
      .defineEvalPass(weightedScore({ weights: { positive: 2, meaning: 1 }, threshold: 0.8 }));
    const compiled = compileAgent(definition);
    expect(compiled.evaluation).toEqual({
      evaluators: {
        positive: { kind: 'custom' },
        meaning: {
          kind: 'llm-judge',
          prompt: 'Compare the invoice summary.',
          model: 'judge-model',
        },
      },
      pass: { kind: 'weighted', weights: { positive: 2, meaning: 1 }, threshold: 0.8 },
    });
    expect(JSON.stringify(compiled)).not.toContain('select');
    const evaluator = definition.evaluation!.evaluators.positive!;
    expect(
      evaluator.kind === 'custom' &&
        evaluator.evaluate({ actual: { total: 1, summary: '' }, expected: undefined })
    ).toBe(1);
  });
  test('weighted passes reject unknown names, empty/all-zero/nonfinite weights and invalid thresholds', () => {
    const chain = base().defineEvaluator('quality', () => 1);
    for (const weights of [
      {} as Record<string, number>,
      { quality: 0 },
      { quality: -1 },
      { quality: Infinity },
    ])
      expect(() => weightedScore({ weights, threshold: 0.5 })).toThrow();
    for (const threshold of [-1, NaN, Infinity, 1.1])
      expect(() => weightedScore({ weights: { quality: 1 }, threshold })).toThrow();
    expect(() =>
      chain.defineEvalPass(weightedScore({ weights: { typo: 1 }, threshold: 0.5 }) as never)
    ).toThrow('registered');
    const weights = { quality: 1 };
    const pass = weightedScore({ weights, threshold: 0.5 });
    weights.quality = 9;
    expect(pass.weights.quality).toBe(1);
  });
  test('duplicate and prototype evaluator names fail without altering the original', () => {
    const chain = base().defineEvaluator('quality', () => 1);
    expect(() => chain.defineEvaluator('quality' as never, () => 0)).toThrow('Duplicate');
    for (const name of ['__proto__', 'prototype', 'constructor', 'bad space', ''])
      expect(() => base().defineEvaluator(name as never, () => 1)).toThrow('name');
    expect(Object.keys(chain.evaluation!.evaluators)).toEqual(['quality']);
    expect(() => createAgent({ name: 'old', evaluators: {} } as never)).toThrow();
  });
  test('preserves advanced comparison options without source function serialization', () => {
    const definition = base()
      .defineEvaluator(
        'fields',
        exactDiff({
          select: (output) => output,
          options: { rules: { $: { numericTolerance: 0.01, allowExtraFields: false } } },
        })
      )
      .defineEvalPass((scores) => scores.fields === 1);
    expect(compileAgent(definition).evaluation?.evaluators.fields?.options).toEqual({
      rules: { $: { numericTolerance: 0.01, allowExtraFields: false } },
    });
    expect(() =>
      exactDiff({ select: () => ({}), options: { rules: { $: {} }, numericTolerance: 0 } })
    ).toThrow();
    expect(() =>
      exactDiff({
        select: () => ({}),
        options: { rules: { $: { ignore: true, order: 'ordered' } } },
      })
    ).toThrow();
  });
  test('compiler rejects forged incomplete or invalid evaluation metadata', () => {
    const forged = (evaluation: unknown) => ({ ...base(), evaluation }) as never;
    expect(() =>
      compileAgent(forged({ evaluators: {}, pass: { kind: 'callback', evaluate: () => true } }))
    ).toThrow();
    expect(() =>
      compileAgent(
        forged({
          evaluators: { x: { kind: 'custom', evaluate: () => 1 } },
          pass: { kind: 'weighted', weights: { unknown: 1 }, threshold: 0.5 },
        })
      )
    ).toThrow();
    expect(() =>
      compileAgent(
        forged({
          evaluators: { x: { kind: 'custom', evaluate: 'wrong' } },
          pass: { kind: 'callback', evaluate: () => true },
        })
      )
    ).toThrow();
    expect(() =>
      compileAgent(
        forged({
          evaluators: { x: { kind: 'llm-judge', prompt: 'short', select: () => ({}) } },
          pass: { kind: 'callback', evaluate: () => true },
        })
      )
    ).toThrow();
    expect(() => weightedScore({ weights: { a: 1e308, b: 1e308 }, threshold: 0.5 })).toThrow();
  });
});

describe('synchronous evaluation declarations', () => {
  test.each([
    ['async', async () => 1],
    [
      'generator',
      function* () {
        yield 1;
      },
    ],
    [
      'async generator',
      async function* () {
        yield 1;
      },
    ],
  ])('rejects %s callbacks without invoking them', (_name, callback) => {
    const evaluate = callback as never;
    expect(() => base().defineEvaluator('score', evaluate)).toThrow(
      'evaluator.evaluate must be a synchronous callback'
    );
    expect(() => base().defineEvaluator('score', { kind: 'custom', evaluate })).toThrow(
      'evaluator.evaluate must be a synchronous callback'
    );
    expect(() => exactDiff({ select: evaluate })).toThrow(
      'exactDiff.select must be a synchronous callback'
    );
    expect(() => base().defineEvaluator('score', { kind: 'exact-diff', select: evaluate })).toThrow(
      'exactDiff.select must be a synchronous callback'
    );
    expect(() => llmJudge({ prompt: 'Compare the invoice answers.', select: evaluate })).toThrow(
      'llmJudge.select must be a synchronous callback'
    );
    const registered = base().defineEvaluator('score', () => 1);
    expect(() => registered.defineEvalPass(evaluate)).toThrow(
      'evaluation.pass must be a synchronous callback'
    );
    const valid = registered.defineEvalPass(() => true);
    expect(() =>
      compileAgent({
        ...valid,
        evaluation: { ...valid.evaluation!, pass: { kind: 'callback', evaluate } },
      })
    ).toThrow('evaluation.pass must be a synchronous callback');
  });
  test('validation does not execute synchronous author callbacks', () => {
    let calls = 0;
    const select = () => {
      calls++;
      return 1;
    };
    compileAgent(
      base()
        .defineEvaluator('custom', select)
        .defineEvaluator('diff', exactDiff({ select }))
        .defineEvaluator('judge', llmJudge({ prompt: 'Compare the invoice answers.', select }))
        .defineEvalPass(() => {
          calls++;
          return true;
        })
    );
    expect(calls).toBe(0);
  });
});
