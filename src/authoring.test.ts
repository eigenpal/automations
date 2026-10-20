import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { compileAgent } from './compiler';
import { createAgent, createTool } from './index';

describe('standalone authoring contract', () => {
  test('compiles an agent without platform libraries', () => {
    expect(compileAgent(createAgent({ name: 'Standalone', triggers: { api: false } }))).toEqual({
      schemaVersion: 1,
      kind: 'agent',
      manifest: {
        schemaVersion: 1,
        name: 'Standalone',
        filesystem: false,
        triggers: { api: false },
      },
    });
  });
  test('preserves required fields, constraints and file annotations', () => {
    const compiled = compileAgent(
      createAgent({
        name: 'Schema',
        inputSchema: z.strictObject({
          document: z.string().meta({ 'x-eigenpal-type': 'file' }),
          count: z.number().int().min(1),
          optional: z.string().optional(),
        }),
      })
    );
    expect(compiled.inputSchema?.required).toEqual(['document', 'count']);
    expect(compiled.inputSchema?.additionalProperties).toBe(false);
    expect(compiled.inputSchema?.properties).toMatchObject({
      document: { type: 'string', 'x-eigenpal-type': 'file' },
      count: { type: 'integer', minimum: 1 },
    });
  });
  test('preserves special JSON Schema keys as data', () => {
    const schema = JSON.parse(
      '{"type":"object","properties":{"__proto__":{"type":"string"},"constructor":{"type":"number"}}}'
    );
    const compiled = compileAgent(createAgent({ name: 'Raw schema', inputSchema: schema }));
    expect(compiled.inputSchema).toEqual(schema);
    expect(Object.hasOwn(compiled.inputSchema!.properties as object, '__proto__')).toBe(true);
  });
  test('rejects parsing effects rather than silently changing the contract', () => {
    expect(() =>
      compileAgent(
        createAgent({ name: 'Invalid', inputSchema: z.object({ text: z.string().trim() }) })
      )
    ).toThrow('inputSchema:');
  });
});

test('async tools fail during authoring or compilation even with raw JSON schemas', () => {
  const options = {
    description: 'Unsupported async tool',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    execute: async () => ({ ok: true }),
  };
  expect(() => createTool(options)).toThrow('synchronous');
  expect(() =>
    compileAgent(createAgent({ name: 'Raw tool', tools: { invalid: options } }))
  ).toThrow('synchronous');
});
