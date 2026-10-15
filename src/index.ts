import { agentConfigSchema } from './config.js';
import type { AgentDefinition, AgentOptions, DefinitionSchema } from './definition.js';

export type {
  AgentConfig,
  AgentDefinition,
  AgentEmailAlias,
  AgentOptions,
  AutomationDefinition,
  CompiledAgent,
  CompiledDefinition,
  DefinitionSchema,
  InferInput,
  InferOutput,
  JsonSchema,
  JsonValue,
} from './definition.js';

/** Define configuration only. Instructions and resources stay in the agent folder. */
export function createAgent<
  I extends DefinitionSchema | undefined = undefined,
  O extends DefinitionSchema | undefined = undefined,
>(options: AgentOptions<I, O>): AgentDefinition<I, O> {
  const { inputSchema, outputSchema, ...config } = options;
  return Object.freeze({
    kind: 'agent' as const,
    config: agentConfigSchema.parse(config),
    ...(inputSchema === undefined ? {} : { inputSchema }),
    ...(outputSchema === undefined ? {} : { outputSchema }),
  });
}
