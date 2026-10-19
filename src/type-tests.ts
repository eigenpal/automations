import { z } from 'zod';
import { createAgent, createTool, type InferInput, type InferOutput } from './index.js';

const invoice = createAgent({
  name: 'Invoice',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ total: z.number() }),
});
const input: InferInput<typeof invoice> = { text: 'invoice' };
const output: InferOutput<typeof invoice> = { total: 1 };
void input;
void output;
// @ts-expect-error Typed input must retain its required field.
const missing: InferInput<typeof invoice> = {};
// @ts-expect-error Typed output retains the field type.
const wrong: InferOutput<typeof invoice> = { total: '1' };
// @ts-expect-error The tools field is a named map, not an array.
createAgent({ name: 'Agent', tools: [] });
void missing;
void wrong;

const inputOnly = createAgent({ name: 'Input only', inputSchema: z.object({ text: z.string() }) });
const outputOnly = createAgent({
  name: 'Output only',
  outputSchema: z.object({ total: z.number() }),
});
const partialInput: InferInput<typeof inputOnly> = { text: 'hello' };
const partialOutput: InferOutput<typeof outputOnly> = { total: 1 };
void partialInput;
void partialOutput;

const calculator = createTool({
  description: 'Calculate total',
  inputSchema: z.object({ subtotal: z.number() }),
  outputSchema: z.object({ total: z.number() }),
  execute: ({ subtotal }) => ({ total: subtotal * 1.2 }),
});
createAgent({ name: 'With tools', tools: { calculator } });
createTool({
  description: 'Invalid',
  inputSchema: z.object({}),
  outputSchema: z.object({ total: z.number() }),
  // @ts-expect-error Tool output follows the declared output contract.
  execute: () => ({ total: 'wrong' }),
});
