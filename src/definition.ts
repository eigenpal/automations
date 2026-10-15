import type { z } from 'zod';

/** JSON Schema stays available for lossless migration of existing schema files. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonSchema = { [key: string]: JsonValue };
export type DefinitionSchema = z.ZodType | JsonSchema;
export type InferSchema<S> = [S] extends [never]
  ? unknown
  : S extends z.ZodType
    ? z.output<S>
    : unknown;

/** Shared envelope; future worker definitions can use this without changing agents. */
export interface AutomationDefinition<K extends string, I, O> {
  readonly kind: K;
  readonly inputSchema?: I;
  readonly outputSchema?: O;
}

export interface AgentEmailAlias {
  address: string;
  /** Omitted leaves platform ownership unchanged; [] explicitly denies all senders. */
  allowlist?: string[];
  replyConfig?: { [key: string]: JsonValue };
  requireSenderAuth?: boolean;
  enabled?: boolean;
}

export interface AgentConfig {
  name: string;
  description?: string;
  model?: string;
  triggers?: {
    api?: boolean;
    email?: { enabled?: boolean; aliases?: (string | AgentEmailAlias)[] };
  };
  dependencies?: Record<string, string>;
  evaluators?: {
    passThreshold?: number;
    items?: { use: string; weight?: number; version?: string }[];
  };
}

export interface AgentOptions<I = DefinitionSchema, O = DefinitionSchema> extends AgentConfig {
  inputSchema?: I;
  outputSchema?: O;
}

export interface AgentDefinition<
  I = DefinitionSchema | undefined,
  O = DefinitionSchema | undefined,
> extends AutomationDefinition<'agent', I, O> {
  readonly config: Readonly<AgentConfig>;
}

export type InferInput<T extends AutomationDefinition<string, unknown, unknown>> = InferSchema<
  NonNullable<T['inputSchema']>
>;
export type InferOutput<T extends AutomationDefinition<string, unknown, unknown>> = InferSchema<
  NonNullable<T['outputSchema']>
>;

/** Versioned data, separate from source syntax and from any execution engine. */
export interface CompiledDefinition<K extends string> {
  schemaVersion: 1;
  kind: K;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
}

export interface CompiledAgent extends CompiledDefinition<'agent'> {
  manifest: AgentConfig & { schemaVersion: 1 };
}
