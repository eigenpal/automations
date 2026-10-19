import { z } from 'zod';
import { agentConfigSchema } from './config.js';
import type { AgentCore, CompiledAgent, DefinitionSchema, JsonSchema } from './definition.js';
import { normalizeEvaluator, validateEvaluatorName, validateWeightedPass } from './evaluation.js';
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

export function compileSchema(schema: DefinitionSchema, field: string): JsonSchema {
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
export function compileAgent<
  I extends DefinitionSchema | undefined,
  O extends DefinitionSchema | undefined,
>(definition: AgentCore<I, O> & { readonly defineEvalPass?: never }): CompiledAgent {
  if (definition.kind !== 'agent') throw new Error('compileAgent expects an agent definition');
  if (definition.config.workspace !== undefined && definition.config.filesystem !== true)
    throw new Error('workspace requires filesystem capability');
  if (
    definition.config.workspace?.cwd === null &&
    Object.keys(definition.config.dependencies ?? {}).length
  )
    throw new Error(
      'Shared file dependencies require a repository working directory; use files with cwd: null'
    );
  const tools = Object.fromEntries(
    Object.entries(definition.tools ?? {}).map(([name, tool]) => {
      if (
        !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name) ||
        [
          '__proto__',
          'constructor',
          'prototype',
          'finish',
          'read',
          'write',
          'edit',
          'bash',
          'grep',
          'find',
          'ls',
          'request_human_review',
          'report_step_progress',
          'web_search',
          'fetch_url',
          'write_workflow_output_json',
          'write_workflow_output_file',
        ].includes(name)
      )
        throw new Error('Invalid tool name');
      if (!tool.description?.trim() || typeof tool.execute !== 'function')
        throw new Error('Invalid tool definition');
      return [
        name,
        {
          description: tool.description,
          inputSchema: compileSchema(tool.inputSchema, `tools.${name}.inputSchema`),
          outputSchema: compileSchema(tool.outputSchema, `tools.${name}.outputSchema`),
        },
      ];
    })
  );
  if (Object.keys(tools).length > 16) throw new Error('At most 16 tools are supported');
  const evaluation = definition.evaluation;
  if (evaluation && !evaluation.pass)
    throw new Error('Evaluation registration must end with defineEvalPass');
  if (evaluation) {
    const names = Object.keys(evaluation.evaluators);
    if (!names.length || names.length > 32)
      throw new Error('Evaluations require 1 to 32 evaluators');
    for (const name of names) {
      validateEvaluatorName(name);
      normalizeEvaluator(evaluation.evaluators[name]!);
    }
    if (evaluation.pass.kind === 'weighted') validateWeightedPass(evaluation.pass, names);
    else if (evaluation.pass.kind !== 'callback' || typeof evaluation.pass.evaluate !== 'function')
      throw new Error('Invalid evaluation pass');
  }
  const compiledEvaluation = evaluation
    ? {
        evaluators: Object.fromEntries(
          Object.entries(evaluation.evaluators).map(([name, evaluator]) => [
            name,
            {
              kind: evaluator.kind,
              ...(evaluator.kind === 'exact-diff' && evaluator.options
                ? { options: evaluator.options }
                : {}),
              ...(evaluator.kind === 'llm-judge'
                ? {
                    prompt: evaluator.prompt,
                    ...(evaluator.model ? { model: evaluator.model } : {}),
                  }
                : {}),
            },
          ])
        ),
        pass:
          evaluation.pass.kind === 'weighted'
            ? {
                kind: 'weighted' as const,
                weights: { ...(evaluation.pass.weights as Record<string, number>) },
                threshold: evaluation.pass.threshold,
              }
            : { kind: 'callback' as const },
      }
    : undefined;
  return {
    ...(compiledEvaluation ? { evaluation: compiledEvaluation } : {}),
    ...(Object.keys(tools).length ? { tools } : {}),
    schemaVersion: 1,
    kind: 'agent',
    manifest: {
      schemaVersion: 1,
      ...agentConfigSchema.parse(definition.config),
      filesystem: definition.config.filesystem ?? false,
    },
    ...(definition.inputSchema === undefined
      ? {}
      : { inputSchema: compileSchema(definition.inputSchema, 'inputSchema') }),
    ...(definition.outputSchema === undefined
      ? {}
      : { outputSchema: compileSchema(definition.outputSchema, 'outputSchema') }),
  };
}
