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
  // @ts-expect-error not an agent configuration stage
  chain.withFilesystem();
  // @ts-expect-error duplicate evaluator
  chain.defineEvaluator('fields', () => 1);
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
    // @ts-expect-error nested filesystem configuration cannot change after evaluation registration
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
