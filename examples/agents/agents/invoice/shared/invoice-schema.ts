import { z } from 'zod';

export const invoiceInput = z.strictObject({ subtotal: z.number().nonnegative() });
export const invoiceOutput = z.strictObject({
  tax: z.number(),
  total: z.number(),
  summary: z.string(),
});
