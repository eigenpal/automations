import { z } from 'zod';
import { createAgent, type InferInput, type InferOutput } from './index.js';

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
// @ts-expect-error Agents do not expose worker tool callbacks yet.
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
