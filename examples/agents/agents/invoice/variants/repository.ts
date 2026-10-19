import { createAgent } from '@eigenpal/automations';
import { invoiceOutput } from '../shared/invoice-schema.js';
import { invoiceResources } from '../shared/resource-versions.js';

// Instructions come from this folder's AGENT.md. cwd defaults to this folder.
export default createAgent({
  name: 'Repository invoice agent',
  outputSchema: invoiceOutput,
  dependencies: invoiceResources,
}).withFilesystem();
