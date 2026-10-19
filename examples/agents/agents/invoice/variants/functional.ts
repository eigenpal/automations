import { createAgent, maxCredits, maxTimeMs, maxTurns } from '@eigenpal/automations';
import { calculateTotal } from '../shared/calculate-total.js';
import { invoiceInput, invoiceOutput } from '../shared/invoice-schema.js';

export default createAgent({
  name: 'Functional invoice agent',
  instructions: 'Use calculateTotal with rate 0.2. Return tax, total and a short summary.',
  inputSchema: invoiceInput,
  outputSchema: invoiceOutput,
  tools: { calculateTotal },
  guards: [maxTurns(10), maxTimeMs(60_000), maxCredits(100)],
  triggers: { api: true },
});
