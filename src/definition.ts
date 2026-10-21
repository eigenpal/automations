import type { z } from 'zod';
import type { CompiledTool, ExecutionGuard, ToolDefinition } from './capabilities.js';
import type {
  AgentEvaluation,
  CompiledEvaluation,
  DeepReadonly,
  EvaluatorInput,
  WeightedPass,
} from './evaluation.js';
import type {
  PortableResource,
  ResourceDeclaration,
  ResourceDefinition,
  Skill,
} from './resources.js';

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
  /** Omit for the agent folder; use a repo-relative path to override, or null for no checkout. Paths use ASCII letters, digits, _, ., - and / only; no traversal. */
  cwd?: string | null;
  /** Directory skills require the filesystem capability. */
  skills?: Record<string, Skill>;
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
}

export interface AgentOptions<I = DefinitionSchema, O = DefinitionSchema> extends Omit<
  AgentConfig,
  'filesystem' | 'workspace'
> {
  /** Zod 4 or raw JSON object schema for run input. Zod infers types; raw schemas infer unknown. No transforms or defaults. */
  inputSchema?: I;
  /** Zod 4 or raw JSON object schema for the final answer. Zod infers evaluator/selector arguments; raw schemas infer unknown. */
  outputSchema?: O;
  /** Import default-exported resource.ts declarations. Keys are local aliases in resource tools and sandbox paths. Files are captured at release, not read by this factory. */
  resources?: Record<string, PortableResource>;
  /** Model-facing names mapped to createTool definitions. Up to 16; built-in names such as read, bash and resource_read are reserved. */
  tools?: Record<string, ToolDefinition<never, unknown>>;
}

export interface AgentCore<
  I = DefinitionSchema | undefined,
  O = DefinitionSchema | undefined,
> extends AutomationDefinition<'agent', I, O> {
  readonly config: DeepReadonly<AgentConfig>;
  readonly resources?: Readonly<Record<string, ResourceDeclaration>>;
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
  /** Opt into a sandbox. Replaces previous filesystem settings; configure before defining evaluators. */
  withFilesystem(options?: FilesystemOptions): AgentDefinition<I, O>;
  /** Register a named score from 0 to 1. Closes agent configuration; output types flow into the callback/selector. */
  defineEvaluator<const N extends string>(
    name: N & EvaluatorName<N>,
    evaluate: EvaluatorInput<InferSchema<O>>
  ): AgentEvaluators<I, O, Record<N, number>>;
}
/** Evaluation registration closes configuration; pass closes evaluation registration. */
export interface AgentEvaluators<I, O, S extends Record<string, number>> extends AgentCore<I, O> {
  /** Register a named score from 0 to 1. Closes agent configuration; output types flow into the callback/selector. */
  defineEvaluator<const N extends string>(
    name: N & EvaluatorName<N> & (N extends keyof S ? never : N),
    evaluate: EvaluatorInput<InferSchema<O>>
  ): AgentEvaluators<I, O, S & Record<N, number>>;
  /** Finish evaluation registration with one typed predicate or weightedScore decision. No further configuration follows. */
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
  resources?: Record<string, ResourceDefinition>;
  tools?: Record<string, CompiledTool>;
  evaluation?: CompiledEvaluation;
}
