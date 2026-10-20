import { createAgent } from '@eigenpal/automations';
import { invoiceOutput } from '../shared/invoice-schema.ts';

export default createAgent({
  name: 'Empty-workspace invoice agent',
  instructions: 'Read invoice.txt and return tax, total and summary using 20% tax.',
  outputSchema: invoiceOutput,
}).withFilesystem({
  cwd: null, // No repository checkout or shared Git resources are materialized.
  files: { 'invoice.txt': 'Subtotal: 100; tax rate: 0.2' },
});
