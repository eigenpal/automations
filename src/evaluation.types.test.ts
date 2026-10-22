import { z } from 'zod';
import { compileAgent } from './compiler.js';
import { createAgent, exactDiff, llmJudge, weightedScore } from './index.js';
export function authoringTypeContracts() {
  const base = createAgent({
    name: 'Typed',
    outputSchema: z.object({ total: z.number(), nested: z.object({ name: z.string() }) }),
  });
  const chain = base
    .withFilesystem()
    .defineEvaluator(
      'fields',
      exactDiff({ select: (output) => ({ total: output.total, name: output.nested?.name }) })
    )
    .defineEvaluator(
      'judge',
      llmJudge({
        prompt: 'Check',
        select: ({ actual, expected }) => ({
          name: actual.nested.name,
          expected: expected?.nested?.name,
        }),
      })
    )
    .defineEvaluator('positive', ({ actual }) => (actual.total > 0 ? 1 : 0));
  chain.defineEvalPass(({ fields, judge }) => fields > 0.5 || judge > 0.5);
  chain.defineEvalPass(weightedScore({ weights: { fields: 2, judge: 1 }, threshold: 0.7 }));
  // @ts-expect-error misspelled registered name
  chain.defineEvalPass(weightedScore({ weights: { feilds: 2 }, threshold: 0.7 }));
  const filesystem = chain.withFilesystem({ cwd: null });
  filesystem.defineEvaluator('typedAfterFilesystem', ({ actual }) => {
    const amount: number = actual.total;
    // @ts-expect-error withFilesystem must preserve exact output inference
    const wrong: string = actual.total;
    void wrong;
    return amount > 0 ? 1 : 0;
  });
  filesystem.defineEvalPass(({ fields, judge, positive }) => fields + judge + positive >= 2);
  // @ts-expect-error filesystem opt-in must not widen the registered score names
  filesystem.defineEvalPass(({ typo }) => typo === 1);
  // @ts-expect-error filesystem opt-in must not permit duplicate score names
  filesystem.defineEvaluator('fields', () => 1);
  const completed = chain.defineEvalPass(({ fields, judge }) => fields > 0.5 || judge > 0.5);
  const completedFilesystem = completed.withFilesystem().withFilesystem({ cwd: null });
  compileAgent(completedFilesystem);
  // @ts-expect-error filesystem extension cannot reopen evaluator registration
  completedFilesystem.defineEvaluator('next', () => 1);
  // @ts-expect-error filesystem extension cannot reopen pass registration
  completedFilesystem.defineEvalPass(() => true);
  // @ts-expect-error duplicate evaluator
  chain.defineEvaluator('fields', () => 1);
  // @ts-expect-error custom scores must be synchronous numbers
  base.defineEvaluator('asyncCustom', async () => 1);
  // @ts-expect-error pass predicates must be synchronous booleans
  chain.defineEvalPass(async () => true);
  // @ts-expect-error score callbacks return number
  base.defineEvaluator('bad', () => true);
  base.defineEvaluator(
    'bad',
    llmJudge({
      prompt: 'x',
      select: ({ actual }) => {
        // @ts-expect-error inference cannot be any
        return actual.nonexistent;
      },
    })
  );
  base.defineEvaluator(
    'bad',
    exactDiff({
      select: (output) => {
        // @ts-expect-error inference cannot be any
        return output.nonexistent;
      },
    })
  );
  // @ts-expect-error no further evaluators after final pass
  chain.defineEvalPass(() => true).defineEvaluator('next', () => 1);

  const widened: string = 'dynamic';
  // @ts-expect-error runtime strings cannot claim a known score registry
  base.defineEvaluator(widened, () => 1);
  const union = Math.random() > 0.5 ? 'a' : 'b';
  // @ts-expect-error a runtime choice cannot claim both scores exist
  base.defineEvaluator(union, () => 1);
  const dynamicWeights: Record<string, number> = { fields: 1 };
  // @ts-expect-error weight names must be known
  chain.defineEvalPass(weightedScore({ weights: dynamicWeights, threshold: 0.5 }));
  // @ts-expect-error selectors cannot be async
  base.defineEvaluator('async', exactDiff({ select: async (output) => ({ total: output.total }) }));
  base.defineEvaluator(
    'functions',
    llmJudge({
      prompt: 'Compare the selected output.',
      // @ts-expect-error judge projections must be JSON, not functions
      select: () => () => 1,
    })
  );
  base.defineEvaluator('readonly', ({ actual }) => {
    // @ts-expect-error evaluation callbacks cannot mutate nested agent output
    actual.nested.name = 'changed';
    return 1;
  });
  base.defineEvaluator(
    'projection',
    exactDiff({
      select: (out) => ({ total: out.total }),
      options: {
        // @ts-expect-error comparison paths belong to the projection
        rules: { typo: { numericTolerance: 0 } },
      },
    })
  );
  base.defineEvaluator(
    'projection',
    exactDiff({
      select: (out) => ({ total: out.total }),
      options: { rules: { total: { numericTolerance: 0 } } },
    })
  );

  // @ts-expect-error an unfinished evaluator chain is not compilable
  compileAgent(chain);
  compileAgent(chain.defineEvalPass((scores) => scores.fields === 1));
  if (chain.config.guards) {
    // @ts-expect-error nested agent configuration remains immutable during evaluation
    chain.config.guards.push({ kind: 'maxTurns', value: 1 });
  }
  if (chain.config.workspace) {
    // @ts-expect-error nested configuration is readonly; derive a new definition with withFilesystem instead
    chain.config.workspace.cwd = null;
  }
  if (chain.tools) {
    // @ts-expect-error model-facing tool registration is immutable
    chain.tools['another'] = chain.tools['existing'];
  }

  const rowsAgent = createAgent({
    name: 'Rows',
    outputSchema: z.object({ rows: z.array(z.object({ sku: z.string(), price: z.number() })) }),
  });
  rowsAgent.defineEvaluator(
    'rows',
    exactDiff({
      select: (out) => ({ rows: out.rows }),
      options: { rules: { rows: { order: 'unordered', matchBy: 'sku' } } },
    })
  );
  rowsAgent.defineEvaluator(
    'badRows',
    exactDiff({
      select: (out) => ({ rows: out.rows }),
      options: {
        rules: {
          rows: {
            order: 'unordered',
            // @ts-expect-error match identity must belong to a selected array item
            matchBy: 'typo',
          },
        },
      },
    })
  );
}

export function tupleInferenceContract() {
  createAgent({
    name: 'Tuple output',
    outputSchema: z.object({ pair: z.tuple([z.string(), z.number()]) }),
  })
    .defineEvaluator('tuple', ({ actual, expected }) => {
      const label: string = actual.pair[0];
      const amount: number = actual.pair[1];
      const expectedLabel: string | undefined = expected?.pair?.[0];
      const expectedAmount: number | undefined = expected?.pair?.[1];
      // @ts-expect-error actual remains deeply readonly, including tuple slots
      actual.pair[0] = 'changed';
      // @ts-expect-error tuple index zero is a string, not a number
      const wrong: number = actual.pair[0];
      void expectedLabel;
      void expectedAmount;
      void wrong;
      return label.length > 0 && amount > 0 ? 1 : 0;
    })
    .defineEvaluator(
      'projection',
      llmJudge({
        prompt: 'Check the pair',
        select: ({ actual }) => {
          const label: string = actual.pair[0];
          const amount: number = actual.pair[1];
          return { label, amount };
        },
      })
    )
    .defineEvalPass(({ tuple, projection }) => tuple === 1 && projection >= 0.5);
}

export function heterogeneousCompilationContract() {
  const left = createAgent({ name: 'Left', outputSchema: z.object({ text: z.string() }) });
  const right = createAgent({ name: 'Right', outputSchema: z.object({ amount: z.number() }) })
    .defineEvaluator('positive', ({ actual }) => (actual.amount > 0 ? 1 : 0))
    .defineEvalPass(({ positive }) => positive === 1);
  [left, right].map(compileAgent);
  [left, right].map((agent) => compileAgent(agent));
  // @ts-expect-error schema constraints must still hold at the erased compilation boundary
  compileAgent({ ...left, outputSchema: 42 });
  // @ts-expect-error an unfinished evaluation chain stays un-compilable in collections
  [left.defineEvaluator('text', ({ actual }) => (actual.text ? 1 : 0)), right].map(compileAgent);
}
