import { z } from 'zod';
import type { DefinitionSchema, InferSchema } from './definition.js';

const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const executionGuardSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('turns'), value: positiveInteger }),
  z.strictObject({ kind: z.literal('timeMs'), value: positiveInteger }),
  z.strictObject({ kind: z.literal('credits'), value: z.number().positive().finite() }),
]);
export type ExecutionGuard = z.infer<typeof executionGuardSchema>;
export const maxTurns = (value: number): ExecutionGuard =>
  executionGuardSchema.parse({ kind: 'turns', value });
export const maxTimeMs = (value: number): ExecutionGuard =>
  executionGuardSchema.parse({ kind: 'timeMs', value });
export const maxCredits = (value: number): ExecutionGuard =>
  executionGuardSchema.parse({ kind: 'credits', value });

export interface ToolDefinition<I = unknown, O = unknown> {
  readonly description: string;
  readonly inputSchema: DefinitionSchema;
  readonly outputSchema: DefinitionSchema;
  readonly execute: (input: I) => O;
}
export function createTool<I extends DefinitionSchema, O extends DefinitionSchema>(options: {
  description: string;
  inputSchema: I;
  outputSchema: O;
  execute: (input: InferSchema<I>) => InferSchema<O>;
}): ToolDefinition<InferSchema<I>, InferSchema<O>> {
  if (!options.description.trim() || typeof options.execute !== 'function')
    throw new Error('Tools require a description and execute callback');
  return Object.freeze({ ...options });
}
// Runtime data only; executable callbacks stay in the separately isolated bundle.
export interface CompiledTool {
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}
