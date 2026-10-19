import { exactDiff, llmJudge, weightedScore } from '@eigenpal/automations';
import invoice from './functional.js';

// Reuse an agent without mutating it. Add .withFilesystem() before evaluators if needed.
const evaluated = invoice
  .defineEvaluator(
    'amounts',
    exactDiff({
      select: (output) => ({ tax: output.tax, total: output.total }),
      options: { rules: { total: { numericTolerance: 0.01 } } },
    })
  )
  .defineEvaluator(
    'meaning',
    llmJudge({
      prompt: 'Does the actual summary preserve the expected invoice facts?',
      select: ({ actual, expected }) => ({ actual: actual.summary, expected: expected?.summary }),
    })
  )
  .defineEvaluator('positive', ({ actual }) => (actual.total >= 0 ? 1 : 0));

export default evaluated.defineEvalPass(
  weightedScore({
    weights: { amounts: 3, meaning: 1, positive: 1 },
    threshold: 0.9,
  })
);

// Alternative pass rule. Each exported definition is immutable and independent.
export const customPass = evaluated.defineEvalPass(
  ({ amounts, meaning, positive }) => positive === 1 && (amounts === 1 || meaning >= 0.95)
);
