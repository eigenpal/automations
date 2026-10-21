import { createAgent } from '@eigenpal/automations';
import { invoiceOutput } from '../shared/invoice-schema.ts';

export default createAgent({
  name: 'Project-root invoice agent',
  instructions: 'Read agents/invoice/invoice.txt and return tax, total and summary using 20% tax.',
  outputSchema: invoiceOutput,
}).withFilesystem({
  cwd: '.', // Any repository-relative directory is accepted; '.' selects its root.
  files: { 'fixtures/tax-rate.txt': '0.2' },
  // Optional, exact-version sandbox libraries. These do not affect TypeScript tool callbacks.
  packages: { npm: { xlsx: '0.18.5' }, python: { numpy: '2.3.3' } },
});
