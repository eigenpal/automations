// These intentionally invalid examples must remain TypeScript errors.
// Remove an @ts-expect-error comment to inspect the diagnostic in your IDE.
import { createAgent, llmJudge, weightedScore } from '@eigenpal/automations';
import { z } from 'zod';

const agent = createAgent({
  name: 'Typing examples',
  instructions: 'Return an invoice total.',
  outputSchema: z.strictObject({ total: z.number(), summary: z.string() }),
});

const evaluated = agent
  .defineEvaluator('accuracy', ({ actual, expected }) => {
    // Hover actual.total: number; expected?.total: number | undefined.
    // @ts-expect-error Output properties come from the agent schema.
    void actual.misspelled;
    // @ts-expect-error Dataset expectations may be absent or partial.
    void expected.total;
    return expected?.total === actual.total ? 1 : 0;
  })
  .defineEvaluator(
    'meaning',
    llmJudge({
      prompt: 'Does the summary preserve the expected facts?',
      select: ({ actual, expected }) => ({
        actual: actual.summary,
        expected: expected?.summary,
        // @ts-expect-error Judge selectors infer the agent output too.
        invalid: actual.unknownField,
      }),
    })
  );

// @ts-expect-error Agent configuration is sealed after the first evaluator.
evaluated.withFilesystem({ cwd: null });

evaluated.defineEvalPass(({ accuracy, meaning }) => accuracy === 1 || meaning >= 0.9);
evaluated.defineEvalPass((scores) => {
  // @ts-expect-error Only registered evaluator names are available.
  return scores.typo >= 0.9;
});

evaluated.defineEvalPass(
  weightedScore({
    weights: { accuracy: 2, meaning: 1 },
    threshold: 0.9,
  })
);

import policy from './resources/knowledge/tax-policy/resource.ts';
import checks from './resources/skills/invoice-checks/resource.ts';
// Resource imports preserve the discriminant, preventing invalid capabilities.
createAgent({ name: 'Portable', resources: { policy } });
createAgent({ name: 'Filesystem' }).withFilesystem({ skills: { checks } });
// @ts-expect-error Directory skills are filesystem-only.
createAgent({ name: 'Invalid', resources: { checks } });
// @ts-expect-error Knowledge is portable content, not a directory skill.
createAgent({ name: 'Invalid' }).withFilesystem({ skills: { policy } });
// @ts-expect-error Shared resource references are imports, never unchecked version strings.
createAgent({ name: 'Invalid', dependencies: { 'workspace:resources.knowledge.typo': '1.0.0' } });
