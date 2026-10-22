import { z } from 'zod';
import { assertSynchronousTool } from './capabilities.js';
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;
export type JsonProjection =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly JsonProjection[]
  | { readonly [key: string]: JsonProjection };
type Join<K extends string, P> = P extends string ? `${K}.${P}` : never;
type Previous = [never, 0, 1, 2, 3, 4];
type ProjectionPath<T, Depth extends number = 4> = [Depth] extends [0]
  ? never
  : T extends readonly (infer U)[]
    ? '[]' | Join<'[]', ProjectionPath<U, Previous[Depth]>>
    : T extends object
      ? {
          [K in keyof T & string]:
            | K
            | (NonNullable<T[K]> extends readonly (infer U)[]
                ? `${K}[]` | Join<`${K}[]`, ProjectionPath<U, Previous[Depth]>>
                : Join<K, ProjectionPath<NonNullable<T[K]>, Previous[Depth]>>);
        }[keyof T & string]
      : never;
type ArrayIdentityPath<P, D extends number = 4> = [D] extends [0]
  ? never
  : P extends readonly (infer I)[]
    ? ProjectionPath<I>
    : P extends object
      ? { [K in keyof P]: ArrayIdentityPath<NonNullable<P[K]>, Previous[D]> }[keyof P]
      : never;
export type SelectedDiffOptions<P> = Omit<
  ExactDiffOptions,
  'rules' | 'paths' | 'unorderedPaths'
> & {
  rules?: Partial<
    Record<
      '$' | ProjectionPath<P>,
      Omit<ExactDiffRule, 'matchBy'> & { matchBy?: ArrayIdentityPath<P> | ArrayIdentityPath<P>[] }
    >
  >;
  paths?: ProjectionPath<P>[];
  unorderedPaths?: ProjectionPath<P>[];
};
/** Stored expected answers may be partial; they are never exposed to the agent. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? { [K in keyof T]: DeepPartial<T[K]> }
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export interface EvaluationContext<T> {
  readonly actual: DeepReadonly<T>;
  readonly expected: DeepReadonly<DeepPartial<T>> | undefined;
}
export type EvaluationCallback<T> = (context: EvaluationContext<T>) => number;
export interface ExactDiffRule {
  ignore?: true;
  order?: 'ordered' | 'unordered';
  items?: 'at-least' | 'at-most' | 'exactly';
  matchBy?: string | string[];
  allowExtraFields?: boolean;
  numericTolerance?: number;
}
export interface ExactDiffOptions {
  rules?: Record<string, ExactDiffRule>;
  paths?: string[];
  unorderedPaths?: string[];
  numericTolerance?: number;
  allowExtraFields?: boolean;
}
const exactOptionsSchema = z
  .strictObject({
    rules: z
      .record(
        z.string().min(1),
        z
          .strictObject({
            ignore: z.literal(true).optional(),
            order: z.enum(['ordered', 'unordered']).optional(),
            items: z.enum(['at-least', 'at-most', 'exactly']).optional(),
            matchBy: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
            allowExtraFields: z.boolean().optional(),
            numericTolerance: z.number().finite().nonnegative().optional(),
          })
          .superRefine((rule, ctx) => {
            if (rule.ignore && Object.keys(rule).length > 1)
              ctx.addIssue({
                code: 'custom',
                message: 'An ignore rule cannot include other options',
              });
            if (rule.matchBy && rule.order !== 'unordered')
              ctx.addIssue({ code: 'custom', message: 'matchBy requires unordered order' });
          })
      )
      .optional(),
    paths: z.array(z.string().min(1)).optional(),
    unorderedPaths: z.array(z.string().min(1)).optional(),
    numericTolerance: z.number().finite().nonnegative().optional(),
    allowExtraFields: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.rules &&
      ['paths', 'unorderedPaths', 'numericTolerance', 'allowExtraFields'].some(
        (key) => key in value
      )
    )
      ctx.addIssue({ code: 'custom', message: 'Cannot mix rules with global comparison options' });
  });
export interface ExactDiffEvaluator<T> {
  readonly kind: 'exact-diff';
  readonly options?: ExactDiffOptions;
  /** Applied to actual and expected separately. */
  readonly select: (output: DeepReadonly<DeepPartial<T>>) => JsonProjection;
}
export interface LlmJudgeEvaluator<T> {
  readonly kind: 'llm-judge';
  readonly prompt: string;
  readonly select: (context: EvaluationContext<T>) => JsonProjection;
  readonly model?: string;
}
export interface CustomEvaluator<T> {
  readonly kind: 'custom';
  readonly evaluate: EvaluationCallback<T>;
}
export type Evaluator<T> = ExactDiffEvaluator<T> | LlmJudgeEvaluator<T> | CustomEvaluator<T>;
export type EvaluatorInput<T> = EvaluationCallback<T> | Evaluator<T>;
export interface WeightedPass<S extends Record<string, number>> {
  readonly kind: 'weighted';
  readonly weights: S;
  readonly threshold: number;
}
export interface CallbackPass<S extends Record<string, number>> {
  readonly kind: 'callback';
  readonly evaluate: (scores: Readonly<S>) => boolean;
}
export type EvaluationPass<S extends Record<string, number>> = WeightedPass<S> | CallbackPass<S>;
export interface AgentEvaluation<
  T = unknown,
  S extends Record<string, number> = Record<string, number>,
> {
  readonly evaluators: Readonly<Record<string, Evaluator<T>>>;
  readonly pass: EvaluationPass<S>;
}
export interface CompiledEvaluation {
  evaluators: Record<
    string,
    {
      kind: 'custom' | 'exact-diff' | 'llm-judge';
      prompt?: string;
      model?: string;
      options?: ExactDiffOptions;
    }
  >;
  pass:
    | { kind: 'callback' }
    | { kind: 'weighted'; weights: Record<string, number>; threshold: number };
}

/** Compare a typed projection, keeping full dataset expected answers unchanged. */
export function exactDiff<T, const P extends JsonProjection>(options: {
  select: (output: DeepReadonly<DeepPartial<T>>) => P;
  options?: SelectedDiffOptions<P>;
}): ExactDiffEvaluator<T> {
  if (typeof options.select !== 'function') throw new Error('exactDiff requires select');
  assertSynchronousTool(options.select, 'exactDiff.select');
  return Object.freeze({
    kind: 'exact-diff',
    select: options.select,
    ...(options.options
      ? { options: freezeEvaluationData(exactOptionsSchema.parse(options.options)) }
      : {}),
  });
}
/** Judge only the explicitly selected data through the worker model connection. */
export function llmJudge<T>(options: {
  prompt: string;
  select: (context: EvaluationContext<T>) => JsonProjection;
  model?: string;
}): LlmJudgeEvaluator<T> {
  if (
    !options.prompt.trim() ||
    options.prompt.length > 128 * 1024 ||
    options.prompt.trim().length < 10
  )
    throw new Error('llmJudge requires a prompt between 10 and 131072 characters');
  if (typeof options.select !== 'function') throw new Error('llmJudge requires select');
  assertSynchronousTool(options.select, 'llmJudge.select');
  if (options.model !== undefined && !options.model.trim())
    throw new Error('llmJudge model cannot be empty');
  return Object.freeze({ kind: 'llm-judge', ...options });
}
/** A declarative weighted average, rendered as controls in the evaluation UI. */
export function weightedScore<const S extends Record<string, number>>(options: {
  weights: S;
  threshold: number;
}): WeightedPass<S> {
  validateWeightedPass(options);
  return Object.freeze({
    kind: 'weighted',
    weights: Object.freeze({ ...options.weights }),
    threshold: options.threshold,
  });
}
export function validateWeightedPass(
  options: { weights: object; threshold: number },
  names?: readonly string[]
): void {
  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 1)
    throw new Error('Evaluation threshold must be between 0 and 1');
  const entries = Object.entries(options.weights);
  if (
    !entries.length ||
    entries.some(
      ([name, weight]) =>
        (names && !names.includes(name)) ||
        typeof weight !== 'number' ||
        !Number.isFinite(weight) ||
        weight < 0
    ) ||
    !entries.some(([, weight]) => weight > 0) ||
    !Number.isFinite(entries.reduce((sum, [, weight]) => sum + weight, 0))
  )
    throw new Error(
      'Weights must reference registered evaluators, be finite and nonnegative, with a positive total'
    );
}

export function freezeEvaluationData<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) freezeEvaluationData(nested);
    Object.freeze(value);
  }
  return value;
}

export function validateEvaluatorName(name: string): void {
  if (
    !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name) ||
    ['constructor', 'prototype', '__proto__'].includes(name)
  )
    throw new Error('Invalid evaluator name');
}
export function normalizeEvaluator<T>(input: EvaluatorInput<T>): Evaluator<T> {
  if (typeof input === 'function') {
    assertSynchronousTool(input, 'evaluator.evaluate');
    return Object.freeze({ kind: 'custom', evaluate: input });
  }
  if (!input || typeof input !== 'object') throw new Error('Invalid evaluator');
  switch (input.kind) {
    case 'custom':
      if (typeof input.evaluate !== 'function')
        throw new Error('Custom evaluator requires a callback');
      assertSynchronousTool(input.evaluate, 'evaluator.evaluate');
      return Object.freeze({ kind: 'custom', evaluate: input.evaluate });
    case 'exact-diff':
      if (typeof input.select !== 'function') throw new Error('exactDiff requires select');
      assertSynchronousTool(input.select, 'exactDiff.select');
      return Object.freeze({
        kind: 'exact-diff',
        select: input.select,
        ...(input.options
          ? { options: freezeEvaluationData(exactOptionsSchema.parse(input.options)) }
          : {}),
      });
    case 'llm-judge':
      return llmJudge(input);
    default:
      throw new Error('Invalid evaluator');
  }
}
