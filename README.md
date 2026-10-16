# EigenPal automation authoring

Open-source TypeScript authoring SDK for EigenPal agents. This package defines
configuration; it does not itself change agent discovery, releases, or execution.
Worker authoring will extend the same package in a later release.

```sh
npm install @eigenpal/automations zod
```

Source: [eigenpal/automations](https://github.com/eigenpal/automations).
Requires Node.js 22 or later to run the compiled ESM package.

```ts
import { createAgent, type InferInput } from '@eigenpal/automations';
import { z } from 'zod';

export const invoice = createAgent({
  name: 'Invoice assistant',
  model: 'organization-model',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.strictObject({ supplier: z.string(), total: z.number() }),
});

export type InvoiceInput = InferInput<typeof invoice>;
export default invoice;
```

`AGENT.md`, skills, rules, knowledge, and templates remain ordinary package files.
The existing folder path determines agent identity; `name` is a display name.
Configuration includes existing API/email triggers, exact-version workspace
dependencies, and evaluator composition. There are no workflow or worker APIs,
tool callbacks, model execution, secret values, or administrative operations.

## Compilation boundary

```ts
import { compileAgent } from '@eigenpal/automations/compiler';
import invoice from './agent.js';

const compiled = compileAgent(invoice);
// { schemaVersion: 1, kind: 'agent', manifest, inputSchema?, outputSchema? }
```

The compiler accepts an already loaded definition and returns JSON data. It does
not read files, load TypeScript, write generated files, publish, or run agents.
The manifest retains today's schema version and fields. The platform's existing
manifest/schema validation still applies at release and execution boundaries.
Full JSON Schema meta-validation is not performed by this package.

Schemas may be Zod 4 schemas or raw JSON Schema objects. Raw schemas preserve
existing `input-schema.json` and `output-schema.json` contracts, including file
extensions, references, defaults, and annotations, for migration. Their inferred
TypeScript value type is `unknown`. Schema roots must have `type: 'object'`, or be exactly `{}` to explicitly
declare no constraints.
Absent schemas remain absent. Raw schemas must contain only JSON values.

Zod is an authoring convenience for JSON Schema validation, not a runtime parser.
Compilation rejects transforms, coercion, defaults, catches, custom refinements,
and overwrites such as `.trim()`, including inside nested schemas. JSON Schema
cannot execute that parsing logic. Use representable constraints or raw JSON
Schema. Normal Zod objects compile in input mode; use `z.strictObject()` when
additional properties should be rejected. Standard JSON Schema annotations such
as defaults are preserved as data and do not promise Zod parsing behavior.

Omitted configuration stays omitted. In particular, an absent email sender
allowlist is different from `allowlist: []`. Defaults continue to be applied by
the existing platform contract. The returned definition envelope is frozen;
compilation revalidates its configuration.

The versioned `CompiledDefinition<K>` envelope separates source syntax from
runtime data. A later worker definition can share that envelope and schema
types without changing agent configuration or adding a worker engine here.

Agents are defined in `agent.ts`. Source conversion is internal migration
tooling, not part of this authoring API.

## Development

```sh
bun install
bun test
bun run typecheck
bun run verify-pack
```

`verify-pack` builds and packs the real package, extracts it into a temporary
consumer, and verifies Node ESM imports and public TypeScript declarations.
It reuses installed Zod without registry access. The tarball contains compiled
JavaScript/declarations, the README and license, with no private platform imports.

The public repository is a release source mirror, maintained under Apache-2.0.
Release tags use the platform release version. The platform release workflow
publishes to npm with GitHub Actions OIDC, then mirrors the published source here.
Please report SDK issues in the public repository.
