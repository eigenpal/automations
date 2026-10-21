import { createAgent } from '@eigenpal/automations';
import policy from '../../resources/knowledge/tax-policy/resource.ts';
import style from '../../resources/rules/invoice-style/resource.ts';
import checks from '../../resources/skills/invoice-checks/resource.ts';
import summary from '../../resources/templates/invoice-summary/resource.ts';
import { calculateTotal } from './shared/calculate-total.ts';
import { invoiceInput, invoiceOutput } from './shared/invoice-schema.ts';

export default createAgent({
  name: 'Invoice reviewer',
  inputSchema: invoiceInput,
  outputSchema: invoiceOutput,
  resources: { policy, style, summary },
  tools: { calculateTotal },
  triggers: { api: true },
}).withFilesystem({ skills: { checks } });
