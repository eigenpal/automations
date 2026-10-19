import { createTool } from '@eigenpal/automations';
import { z } from 'zod';

// Normal TypeScript imports reuse tool definitions, with inferred inputs and outputs.
export const calculateTotal = createTool({
  description: 'Calculate tax and total from subtotal and tax rate.',
  inputSchema: z.strictObject({
    subtotal: z.number().nonnegative(),
    rate: z.number().nonnegative(),
  }),
  outputSchema: z.strictObject({ tax: z.number(), total: z.number() }),
  execute: ({ subtotal, rate }) => {
    const tax = Math.round(subtotal * rate * 100) / 100;
    return { tax, total: subtotal + tax };
  },
});
