import type { JsonSchema, JsonValue } from './definition.js';

/** Validate and copy JSON without dropping keys such as __proto__ or constructor. */
export function copyJsonSchema(schema: unknown): JsonSchema {
  const ancestors = new Set<object>();
  function copy(value: unknown): JsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || value === null) throw new Error('Expected a JSON value');
    if (ancestors.has(value)) throw new Error('Cyclic JSON value');
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
      throw new Error('Expected a plain JSON object');
    if (Object.getOwnPropertySymbols(value).length) throw new Error('Symbol keys are not JSON');
    ancestors.add(value);
    try {
      if (Array.isArray(value)) return Array.from(value, copy);
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
    } finally {
      ancestors.delete(value);
    }
  }
  const result = copy(schema);
  if (result === null || typeof result !== 'object' || Array.isArray(result))
    throw new Error('Expected a JSON Schema object');
  return result;
}
