import { z } from 'zod';
import { agentConfigSchema } from './config.js';
import type { AgentDefinition, CompiledAgent, DefinitionSchema, JsonSchema } from './definition.js';
import { copyJsonSchema } from './json-schema.js';

const portableChecks = new Set([
  'less_than',
  'greater_than',
  'multiple_of',
  'number_format',
  'max_length',
  'min_length',
  'length_equals',
  'string_format',
]);

function compileSchema(schema: DefinitionSchema, field: string): JsonSchema {
  try {
    const json =
      schema instanceof z.ZodType
        ? z.toJSONSchema(schema, {
            target: 'draft-7',
            io: 'input',
            unrepresentable: 'throw',
            override: ({ zodSchema }) => {
              const def = zodSchema._zod.def;
              // JSON Schema validates data; it cannot execute parsing/defaulting logic.
              if (
                ['default', 'prefault', 'catch', 'pipe', 'transform'].includes(def.type) ||
                ('coerce' in def && def.coerce) ||
                def.checks?.some((check) => !portableChecks.has(check._zod.def.check))
              ) {
                throw new Error(
                  'Parsing effects and custom refinements are not portable; use JSON Schema constraints'
                );
              }
            },
          })
        : schema;
    const parsed = copyJsonSchema(json);
    if (Object.keys(parsed).length !== 0 && parsed.type !== 'object')
      throw new Error('Root schema type must be object');
    return parsed;
  } catch (error) {
    throw new Error(`${field}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Accepts an already loaded definition. Loading/executing tenant TS is a separate boundary. */
export function compileAgent(definition: AgentDefinition): CompiledAgent {
  if (definition.kind !== 'agent') throw new Error('compileAgent expects an agent definition');
  return {
    schemaVersion: 1,
    kind: 'agent',
    manifest: { schemaVersion: 1, ...agentConfigSchema.parse(definition.config) },
    ...(definition.inputSchema === undefined
      ? {}
      : { inputSchema: compileSchema(definition.inputSchema, 'inputSchema') }),
    ...(definition.outputSchema === undefined
      ? {}
      : { outputSchema: compileSchema(definition.outputSchema, 'outputSchema') }),
  };
}
