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
/** Validate callbacks without invoking author code. Runtime also rejects returned promises. */
export function assertSynchronousTool(execute: unknown, field = 'execute'): void {
  if (
    typeof execute !== 'function' ||
    [
      '[object AsyncFunction]',
      '[object AsyncGeneratorFunction]',
      '[object GeneratorFunction]',
    ].includes(Object.prototype.toString.call(execute))
  )
    throw new Error(`${field} must be a synchronous callback returning JSON data`);
}
/** Define a typed calculation tool. Callbacks run in bounded QuickJS, without Node, network or filesystem access. */
export function createTool<I extends DefinitionSchema, O extends DefinitionSchema>(options: {
  /** Model-facing explanation of when this tool is useful. */
  description: string;
  /** Zod 4 or raw JSON object schema. Zod infers arguments; raw schemas infer unknown. */
  inputSchema: I;
  /** Zod 4 or raw JSON object schema. Zod checks return types; both validate the returned JSON at runtime. */
  outputSchema: O;
  /** Synchronous, JSON-compatible computation. No host APIs or asynchronous I/O. */
  execute: (input: InferSchema<I>) => InferSchema<O>;
}): ToolDefinition<InferSchema<I>, InferSchema<O>> {
  if (!options.description.trim() || typeof options.execute !== 'function')
    throw new Error('Tools require a description and execute callback');
  assertSynchronousTool(options.execute);
  return Object.freeze({ ...options });
}
// Runtime data only; executable callbacks stay in the separately isolated bundle.
export interface CompiledTool {
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}
