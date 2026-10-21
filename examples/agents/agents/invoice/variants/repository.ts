import { createAgent } from '@eigenpal/automations';
import policy from '../../../resources/knowledge/tax-policy/resource.ts';
import style from '../../../resources/rules/invoice-style/resource.ts';
import checks from '../../../resources/skills/invoice-checks/resource.ts';
import summary from '../../../resources/templates/invoice-summary/resource.ts';
import { invoiceOutput } from '../shared/invoice-schema.ts';

// Instructions come from this folder's AGENT.md. cwd defaults to this folder.
export default createAgent({
  name: 'Repository invoice agent',
  outputSchema: invoiceOutput,
  resources: { policy, style, summary },
}).withFilesystem({ skills: { checks } });
