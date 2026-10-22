import { assertSynchronousTool } from './capabilities.js';
import { agentConfigSchema, filesystemOptionsSchema } from './config.js';
import type {
  AgentConfig,
  AgentDefinition,
  AgentOptions,
  DefinitionSchema,
  FilesystemOptions,
} from './definition.js';
import type { Evaluator, EvaluatorInput } from './evaluation.js';
import {
  freezeEvaluationData,
  normalizeEvaluator,
  validateEvaluatorName,
  validateWeightedPass,
} from './evaluation.js';
import { resourceDeclarationMapSchema as resourceMapSchema } from './resources.js';

export type {
  AgentConfig,
  AgentCore,
  AgentDefinition,
  AgentEmailAlias,
  AgentEvaluators,
  AgentOptions,
  AutomationDefinition,
  CompiledAgent,
  CompiledDefinition,
  DefinitionSchema,
  FilesystemOptions,
  InferInput,
  InferOutput,
  JsonSchema,
  JsonValue,
} from './definition.js';

/** Define an agent. Instructions may be inline or resolved from package-local AGENT.md. */
export function createAgent<
  I extends DefinitionSchema | undefined = undefined,
  O extends DefinitionSchema | undefined = undefined,
>(options: AgentOptions<I, O>): AgentDefinition<I, O> {
  const { inputSchema, outputSchema, tools, resources, ...config } = options;
  const portable = resourceMapSchema.parse(resources ?? {});
  if (Object.values(portable).some((resource) => resource.kind === 'skill'))
    throw new Error('Skills require .withFilesystem({ skills })');
  const toolMap = tools === undefined ? undefined : Object.freeze({ ...tools });
  const parsed = agentConfigSchema.omit({ filesystem: true, workspace: true }).parse(config);
  function build(
    config: AgentConfig,
    evaluators: Record<string, Evaluator<unknown>> = {},
    pass?: unknown,
    attached = portable
  ): AgentDefinition<I, O> {
    const names = Object.keys(evaluators);
    const addEvaluator = (name: string, input: EvaluatorInput<unknown>) => {
      validateEvaluatorName(name);
      if (Object.hasOwn(evaluators, name)) throw new Error(`Duplicate evaluator: ${name}`);
      if (names.length >= 32) throw new Error('At most 32 evaluators are supported');
      const evaluator = normalizeEvaluator(input);
      return build(
        config,
        { ...evaluators, [name]: Object.freeze({ ...evaluator }) },
        undefined,
        attached
      );
    };
    const defineEvalPass = (input: unknown) => {
      const descriptor =
        typeof input === 'function'
          ? { kind: 'callback', evaluate: input }
          : (input as { kind: string; weights: object; threshold: number });
      if (descriptor?.kind === 'weighted')
        validateWeightedPass(descriptor as { weights: object; threshold: number }, names);
      else if (
        descriptor?.kind !== 'callback' ||
        typeof (descriptor as { evaluate?: unknown }).evaluate !== 'function'
      )
        throw new Error('Invalid evaluation pass');
      if (descriptor.kind === 'callback')
        assertSynchronousTool((descriptor as { evaluate: unknown }).evaluate, 'evaluation.pass');
      return build(config, evaluators, freezeEvaluationData({ ...descriptor }), attached);
    };
    const freeze = <T>(value: T): T => {
      if (value && typeof value === 'object') {
        for (const nested of Object.values(value)) freeze(nested);
        Object.freeze(value);
      }
      return value;
    };
    return Object.freeze({
      kind: 'agent' as const,
      ...(Object.keys(attached).length ? { resources: freezeEvaluationData(attached) } : {}),
      ...(toolMap === undefined ? {} : { tools: toolMap }),
      config: freeze(config),
      ...(inputSchema === undefined ? {} : { inputSchema }),
      ...(outputSchema === undefined ? {} : { outputSchema }),
      ...(names.length
        ? {
            evaluation: Object.freeze({
              evaluators: Object.freeze({ ...evaluators }),
              ...(pass ? { pass } : {}),
            }),
          }
        : {}),
      withFilesystem(options: FilesystemOptions = {}) {
        const { skills, ...settings } = options;
        const workspace = filesystemOptionsSchema.parse(settings);
        const parsedSkills = resourceMapSchema.parse(skills ?? {});
        if (Object.values(parsedSkills).some((resource) => resource.kind !== 'skill'))
          throw new Error('Use resources for knowledge, rules and templates');
        if (Object.keys(parsedSkills).some((name) => Object.hasOwn(portable, name)))
          throw new Error('Duplicate resource name');
        const { workspace: _previous, ...base } = config;
        return build(
          {
            ...base,
            filesystem: true,
            ...(Object.keys(workspace).length ? { workspace } : {}),
          },
          evaluators,
          pass,
          { ...portable, ...parsedSkills }
        );
      },
      ...(pass
        ? {}
        : names.length
          ? { defineEvaluator: addEvaluator, defineEvalPass }
          : { defineEvaluator: addEvaluator }),
    }) as unknown as AgentDefinition<I, O>;
  }
  return build(parsed);
}

export { createTool, maxCredits, maxTimeMs, maxTurns } from './capabilities.js';
export type { CompiledTool, ExecutionGuard, ToolDefinition } from './capabilities.js';

export { exactDiff, llmJudge, weightedScore } from './evaluation.js';
export type {
  AgentEvaluation,
  CompiledEvaluation,
  DeepPartial,
  DeepReadonly,
  EvaluationCallback,
  EvaluationContext,
  EvaluationPass,
  Evaluator,
  EvaluatorInput,
  ExactDiffOptions,
  ExactDiffRule,
  JsonProjection,
  SelectedDiffOptions,
  WeightedPass,
} from './evaluation.js';

export { createKnowledge, createRule, createSkill, createTemplate } from './resources.js';
export type {
  BinaryAsset,
  DirectoryResource,
  PortableResource,
  ResourceDeclaration,
  ResourceDefinition,
  ResourceFile,
  Skill,
  TextAsset,
} from './resources.js';
