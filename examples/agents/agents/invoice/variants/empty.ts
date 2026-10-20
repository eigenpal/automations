import { createAgent } from '@eigenpal/automations';
import checks from '../../../resources/skills/invoice-checks/resource.ts';
import { invoiceOutput } from '../shared/invoice-schema.ts';

export default createAgent({
  name: 'Empty-workspace invoice agent',
  instructions: 'Read invoice.txt and return tax, total and summary using 20% tax.',
  outputSchema: invoiceOutput,
}).withFilesystem({
  cwd: null, // Skip the repository checkout; explicitly attached skills remain available.
  skills: { checks },
  files: { 'invoice.txt': 'Subtotal: 100; tax rate: 0.2' },
});
