import { createAgent, maxCredits, maxTimeMs, maxTurns } from '@eigenpal/automations';
import policy from '../../../resources/knowledge/tax-policy/resource.ts';
import style from '../../../resources/rules/invoice-style/resource.ts';
import summary from '../../../resources/templates/invoice-summary/resource.ts';
import { calculateTotal } from '../shared/calculate-total.ts';
import { invoiceInput, invoiceOutput } from '../shared/invoice-schema.ts';

export default createAgent({
  name: 'Functional invoice agent',
  resources: { policy, style, summary },
  instructions: 'Use calculateTotal with rate 0.2. Return tax, total and a short summary.',
  inputSchema: invoiceInput,
  outputSchema: invoiceOutput,
  tools: { calculateTotal },
  guards: [maxTurns(10), maxTimeMs(60_000), maxCredits(100)],
  triggers: { api: true },
});
