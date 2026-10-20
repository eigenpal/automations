import { createAgent } from '@eigenpal/automations';
import policy from '../../../resources/knowledge/tax-policy/resource.js';
import style from '../../../resources/rules/invoice-style/resource.js';
import checks from '../../../resources/skills/invoice-checks/resource.js';
import summary from '../../../resources/templates/invoice-summary/resource.js';
import { invoiceOutput } from '../shared/invoice-schema.js';

// Instructions come from this folder's AGENT.md. cwd defaults to this folder.
export default createAgent({
  name: 'Repository invoice agent',
  outputSchema: invoiceOutput,
  resources: { policy, style, summary },
}).withFilesystem({ skills: { checks } });
