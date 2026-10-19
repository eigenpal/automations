import type { z } from 'zod';
import type { CompiledTool, ExecutionGuard, ToolDefinition } from './capabilities.js';
import type {
  AgentEvaluation,
  CompiledEvaluation,
  DeepReadonly,
  EvaluatorInput,
  WeightedPass,
} from './evaluation.js';

/** Raw JSON Schema preserves complete contracts and platform-specific annotations. */
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

/** Additive sandbox capability. Paths are relative; package versions must be exact. */
export interface FilesystemOptions {
  /** Defaults to the agent package folder. A path selects a project directory; null starts empty. */
  cwd?: string | null;
  /** UTF-8 seed files relative to cwd. Existing differing files are never overwritten. */
  files?: Record<string, string>;
  /** Extra sandbox dependencies, combined with repository package manifests. */
  packages?: { python?: Record<string, string>; npm?: Record<string, string> };
}

export interface AgentConfig {
  name: string;
  description?: string;
  model?: string;
  instructions?: string;
  filesystem?: boolean;
  /** Normalized sandbox capability; author with .withFilesystem(). */
  workspace?: FilesystemOptions;
  guards?: ExecutionGuard[];
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

export interface AgentOptions<I = DefinitionSchema, O = DefinitionSchema> extends Omit<
  AgentConfig,
  'filesystem' | 'workspace' | 'evaluators'
> {
  inputSchema?: I;
  outputSchema?: O;
  tools?: Record<string, ToolDefinition<never, unknown>>;
}

export interface AgentCore<
  I = DefinitionSchema | undefined,
  O = DefinitionSchema | undefined,
> extends AutomationDefinition<'agent', I, O> {
  readonly config: DeepReadonly<AgentConfig>;
  readonly tools?: Readonly<Record<string, ToolDefinition<never, unknown>>>;
  readonly evaluation?: AgentEvaluation<InferSchema<O>, never>;
}
type IsUnion<T, Whole = T> = T extends Whole ? ([Whole] extends [T] ? false : true) : never;
type EvaluatorName<N extends string> = string extends N
  ? never
  : true extends IsUnion<N>
    ? never
    : N;
export interface AgentDefinition<
  I = DefinitionSchema | undefined,
  O = DefinitionSchema | undefined,
> extends AgentCore<I, O> {
  withFilesystem(options?: FilesystemOptions): AgentDefinition<I, O>;
  defineEvaluator<const N extends string>(
    name: N & EvaluatorName<N>,
    evaluate: EvaluatorInput<InferSchema<O>>
  ): AgentEvaluators<I, O, Record<N, number>>;
}
/** Evaluation registration closes configuration; pass closes evaluation registration. */
export interface AgentEvaluators<I, O, S extends Record<string, number>> extends AgentCore<I, O> {
  defineEvaluator<const N extends string>(
    name: N & EvaluatorName<N> & (N extends keyof S ? never : N),
    evaluate: EvaluatorInput<InferSchema<O>>
  ): AgentEvaluators<I, O, S & Record<N, number>>;
  defineEvalPass<const W extends Record<string, number>>(
    pass:
      | ((scores: Readonly<S>) => boolean)
      | (WeightedPass<W> & {
          readonly weights: Partial<S> & Record<Exclude<keyof W, keyof S>, never>;
        })
  ): AgentCore<I, O>;
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
  manifest: AgentConfig & { schemaVersion: 1; filesystem: boolean };
  tools?: Record<string, CompiledTool>;
  evaluation?: CompiledEvaluation;
}
