import { createAgent } from '@eigenpal/automations';
import policy from '../../resources/knowledge/tax-policy/resource.js';
import style from '../../resources/rules/invoice-style/resource.js';
import checks from '../../resources/skills/invoice-checks/resource.js';
import summary from '../../resources/templates/invoice-summary/resource.js';
import { calculateTotal } from './shared/calculate-total.js';
import { invoiceInput, invoiceOutput } from './shared/invoice-schema.js';

export default createAgent({
  name: 'Invoice reviewer',
  inputSchema: invoiceInput,
  outputSchema: invoiceOutput,
  resources: { policy, style, summary },
  tools: { calculateTotal },
  triggers: { api: true },
}).withFilesystem({ skills: { checks } });
