# EigenPal automation authoring

Open-source TypeScript authoring SDK for EigenPal agents. This package defines
configuration; it does not itself change agent discovery, releases, or execution.
Filesystem access is an explicit agent capability.

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
dependencies, and evaluator composition. There are no workflow authoring APIs, model execution in this public package,
secret values, or administrative operations.

## Explore complete examples

Open [`examples/agents`](examples/agents/README.md) for a standalone IDE project with
functional and filesystem agents, typed tools, evaluations, and all four directory-backed
shared resource kinds. Its README includes local setup, type checks and Git installation steps.

## Compilation boundary

```ts
import { compileAgent } from '@eigenpal/automations/compiler';
import invoice from './agent.ts';

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
runtime data. Execution capabilities extend the agent envelope without introducing another
automation kind.

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

## Define an agent

Put `agent.ts` in `agents/invoice-reviewer/` in the organization repository:

```ts
import { createAgent, createTool, maxTurns, maxTimeMs, maxCredits } from '@eigenpal/automations';
import { z } from 'zod';

const invoiceReviewer = createAgent({
  name: 'Invoice reviewer',
  instructions: 'Call calculateTotal with the supplied subtotal. Return its result.',
  inputSchema: z.object({ subtotal: z.number().nonnegative() }),
  outputSchema: z.strictObject({ total: z.number() }),
  tools: {
    calculateTotal: createTool({
      description: 'Calculate the total with 20% tax.',
      inputSchema: z.object({ subtotal: z.number().nonnegative() }),
      outputSchema: z.strictObject({ total: z.number() }),
      execute: ({ subtotal }) => ({ total: Math.round(subtotal * 120) / 100 }),
    }),
  },
  guards: [maxTurns(10), maxTimeMs(60_000), maxCredits(100)],
});

export default invoiceReviewer;
```

This runs without a filesystem sandbox. Tools and schemas are inferred from Zod;
`{ subtotal: 100 }` can produce `{ total: 120 }`. The repository folder determines
agent identity; the display name can change without changing that identity.

`createAgent` properties:

- `name`: required display name.
- `description`: optional description for discovery.
- `model`: optional configured organization model identifier; omission uses the existing platform selection.
- `instructions`: optional nonblank text, up to 128 KiB. If omitted, use the exact package-local `AGENT.md` from the pinned Git commit. Inline text overrides that file; the two are not concatenated. Execution requires nonblank resolved instructions in either mode.
- `inputSchema`: optional object schema for run input. Prefer Zod 4. Raw JSON Schema remains accepted for existing contracts.
- `outputSchema`: optional object schema for the validated final answer. Prefer `z.strictObject` to reject unexpected fields.
- `tools`: optional map of names to `createTool(...)` definitions. Names become model-facing tool names. At most 16; built-in names such as `read`, `write`, `bash` and `finish` are reserved.
- `guards`: optional array of positive limits. `maxTurns(n)` bounds model requests, including retries; `maxTimeMs(n)` bounds active execution time, including preparation but excluding time parked for human review; `maxCredits(n)` bounds model credits only. One credit is one cent. `maxTimeMs(n)` bounds active sandbox execution time; sandbox compute is billed separately. Repeated limits use the strictest value and continue across human-review resumes. Platform ceilings remain 128 turns, 20 active minutes and 10,000 model credits, with any tighter deployment settings still applying. Conservative request admission can stop before the exact limit when the remaining balance cannot cover the next bounded request.
- `triggers`: optional `{ api, email: { enabled, aliases } }`. API defaults to enabled; absent email is disabled. Aliases may be addresses or objects with `address`, `allowlist`, `replyConfig`, `requireSenderAuth` and `enabled`. An omitted allowlist preserves platform ownership; `[]` denies all senders. Existing email routing rules continue to apply.
- `resources`: optional map of imported knowledge, rules and templates. Keys are local aliases; TypeScript checks each imported definition. See shared resources below. Evaluators are registered through the chain, never a `createAgent` property.

`createTool` properties:

- `description`: required nonblank model-facing explanation of when to call the tool.
- `inputSchema`: required object schema; validates arguments before invocation and infers the callback input.
- `outputSchema`: required object schema; validates the returned value and checks its TypeScript shape.
- `execute`: required synchronous TypeScript callback. Local helpers and captured serializable constants are bundled. The existing QuickJS script sandbox executes the callback with bounded time/memory/output and without host credentials, filesystem, network or arbitrary Node packages. Async callbacks are rejected. This boundary stays the same in both agent modes.

Zod schemas must be representable as JSON Schema. Transforms, coercion, defaults,
custom refinements and parsing effects such as `.trim()` are rejected rather than
silently ignored. Use portable constraints such as `.min()` and `.nonnegative()`.

## Add filesystem access

Use the same agent with an added capability:

```ts
export default invoiceReviewer.withFilesystem({
  // Optional, relative to the repository root. Default: this agent's folder.
  cwd: 'agents/invoice-reviewer',

  // Optional UTF-8 seed files, relative to cwd.
  files: { 'scratch/tax.json': '{"rate":0.2}' },

  // Optional extra packages installed inside the sandbox before execution.
  packages: {
    python: { openpyxl: '3.1.5', numpy: '2.3.3' },
    npm: { 'decimal.js': '10.6.0' },
  },
});
```

`.withFilesystem()` without arguments is enough to opt in. It returns a new
immutable definition, preserving the input/output types, tools, instructions,
triggers and guards. The original agent stays filesystem-free. Repeating the
method replaces its filesystem options; it does not silently merge them.
There is one public spelling for opt-in, with no separate agent type or
`filesystem: true` authoring option.

For an omitted or string `cwd`, the runtime clones the repository at the run's
exact Git commit and starts the existing filesystem agent with read/write/edit/shell capabilities. The capability
adds filesystem tools to the same agent contract. It does not move custom
TypeScript callbacks into an unrestricted Node process.

To start empty instead of checking out the project:

```ts
export default invoiceReviewer.withFilesystem({
  cwd: null,
  files: { 'invoice.json': '{"subtotal":100}' },
});
```

The definition and instructions still come from the pinned source snapshot, but
repository files, manifests and repository environment declarations are not loaded.
Use `files` for initial content and `packages` for additional installed libraries.
Explicitly attached resources and skills remain available with `cwd: null`.
Platform tools and run input/output paths remain outside the working directory.

Filesystem options:

- `cwd`: omit it to start in the folder exporting the agent; use a repository-relative existing directory to override it, or `'.'` for the repository root. Set `null` to skip the execution checkout and start with a working directory populated by `files` and explicitly attached resources. An empty string is rejected. String paths must remain inside the checkout after symlink resolution. The option selects initial content/location, not sandbox filesystem permissions.
- `skills`: optional map of imported `createSkill` definitions. Directory skills and their helper files also work with `cwd: null`.
- `files`: optional map of relative paths to text. At most 100 files and 256 KiB total UTF-8 paths/content. Creates missing directories. Identical existing content is accepted; differing content, symlinks, traversal, absolute paths and managed directories (`.git`, `.eigenpal`, `node_modules`, `eigenpal_modules`) fail before model execution. Binary assets and larger files belong in Git or normal run file inputs. Seed files initialize the workspace; they do not update the Git repository.
- `packages.python`: optional package-to-exact-version map, such as `{ numpy: '2.3.3' }`. Combined with `requirements.txt` in the selected directory in one `uv` install, so conflicting requirements fail.
- `packages.npm`: optional package-to-exact-version map, such as `{ 'decimal.js': '10.6.0' }`. Combined with the selected directory's `package.json`; conflicting declared versions fail. Existing `bun.lock` is reused by the current installer. This pins declared direct versions; it does not promise a fully locked transitive environment.

There are at most 32 additional packages across both maps. Python accepts numeric
release versions with two to four components; npm accepts exact three-component
versions, including prereleases. Ranges, URLs, install flags and alternate package
indexes are not accepted in these maps. Existing repository manifests still work
without declaring any extra packages. Install failures stop setup before the model
runs. Packages install only inside the sandbox, never on the application host.

There is no `language` flag: shell scripts can use both Python and JavaScript in
one run. A Python package makes Python scripts available to the filesystem agent;
it does not turn `createTool.execute` into a Python callback. Python callbacks and
Monty are outside this PR.

On deployments without a sandbox provider, ordinary agents still run. Starting a
filesystem agent returns `agent_capability_unavailable` before model execution or
sandbox provisioning; it never silently downgrades the agent.

## Shared resources

From your agent directory, use `eigenpal agents validate` to capture and validate
the definition against your configured deployment. In the provided example project, `bun run typecheck` checks
authoring types locally. The deployment must include directory-resource support.
The low-level `compileAgent` API does not discover files; it expects already captured
resources. The public example's `bun run check` verifies its bundled synthetic fixtures
locally, without credentials, deployment access or model calls.

For a new project, the CLI creates the SDK/Zod/TypeScript dependencies, a strict
no-emit tsconfig supporting `.ts` imports, and a `typecheck` script. Existing
project configuration is preserved:

```sh
eigenpal agents init invoice --template agent
bun install
bun run typecheck
cd agents/invoice
eigenpal agents validate
```

A resource is a directory with a default-exported `resource.ts`. Import the definition;
EigenPal captures its accompanying files from the same Git commit as the agent.
No asset imports, `content`, `files` maps, YAML manifests or dependency-version strings.

```ts
// resources/knowledge/tax-policy/resource.ts
import { createKnowledge } from '@eigenpal/automations';
export default createKnowledge({ name: 'Tax policy' });
// Add README.md, rates.csv, guidance.pdf, or nested document folders beside it.

// resources/rules/invoice-style/resource.ts
import { createRule } from '@eigenpal/automations';
export default createRule({ name: 'Invoice style' });
// Put instructions in RULE.md beside it.

// resources/templates/invoice/resource.ts
import { createTemplate } from '@eigenpal/automations';
export default createTemplate({ name: 'Invoice' });
// Put template.docx, template.xlsx or template.md beside it, exactly one.

// resources/skills/invoice-checks/resource.ts
import { createSkill } from '@eigenpal/automations';
export default createSkill({ name: 'Invoice checks' });
// Keep SKILL.md and scripts/, references/, or other helper files beside it.
```

All factories accept `name` and optional `description`. Templates additionally accept
`file`, such as `createTemplate({ name: 'Invoice', file: 'invoice.docx' })`, when the
entry uses another filename. It must remain inside the resource directory. Ambiguous
or missing entries fail validation. Markdown templates use `{{field}}` and nested
`{{customer.name}}` variables; Liquid control tags are unsupported. DOCX/XLSX use the
platform Office template syntax:

- DOCX scalar: `Supplier: {supplier}`.
- DOCX loop: `{#items}{name}: {amount}{/items}` with `items: [{ name, amount }]`.
- DOCX conditional: `{#approved}Approved{/approved}` with a boolean value.
- XLSX scalar: `{supplier}` in a cell.
- XLSX table: `{table:items.name}` and `{table:items.amount}` in adjacent cells.

Office placeholders use single braces. Raw XML insertion and XLSX image placeholders are unsupported by resource
tools. Template expansion, extracted text and artifact bytes are bounded before output
registration; generated files never overwrite source templates.

```ts
// agents/invoice/agent.ts
import { createAgent } from '@eigenpal/automations';
import policy from '../../resources/knowledge/tax-policy/resource.ts';
import style from '../../resources/rules/invoice-style/resource.ts';
import invoice from '../../resources/templates/invoice/resource.ts';

export default createAgent({
  name: 'Invoice reviewer',
  instructions: 'Check the invoice using the tax policy and fill its summary.',
  resources: { policy, style, invoice },
});
```

Rules enter the instructions directly. Knowledge and templates add a small catalog
and built-in tools, rather than flooding model context with document text:

- `resource_list({ resource })` lists captured file paths for any attached resource.
- `resource_search({ resource, query })` performs case-insensitive literal search,
  returning up to ten excerpts with paths and character offsets. No vector service is required.
- `resource_read({ resource, path, offset?, limit? })` reads extracted text (or registers a downloadable artifact for a binary companion file), up to
  12,000 characters per call, and returns `nextOffset` for paging.
- `template_inspect({ resource })` discovers template placeholders.
- `template_fill({ resource, data, filename? })` fills the captured template and
  registers a downloadable run artifact, returning its `fileId` and `name`.

`resource` is the imported alias (`policy` or `invoice` above). Tool schemas enumerate
only attached aliases. Browse tools also expose rule/template companion files. Built-in names are reserved so custom tools cannot shadow them.
Knowledge supports Markdown, UTF-8 text, CSV, JSON, PDF, DOCX and XLSX. PDF access
uses the deployment's existing bounded text extractor; scanned PDFs need a text layer.
Document contents are untrusted reference data, not additional agent instructions.
Missing template values, unsupported formats and oversized outputs fail explicitly.

Filesystem agents gain the same tools and receive the original resource directories:

```ts
import checks from '../../resources/skills/invoice-checks/resource.ts';
// Extend the agent configuration before registering evaluators:
// createAgent({ ... }).withFilesystem({ skills: { checks } });
```

Files are installed under `/workspace/agent/.eigenpal-resources/<alias>/`. Skills
include `SKILL.md` and their helpers; helper code is data until explicitly executed
inside the filesystem sandbox. Ordinary agents cannot attach directory skills. Filesystem agents receive a skill catalog and the path to SKILL.md, then read instructions/helpers as needed. Scripts do not run automatically.
`cwd: null` skips the repository checkout but still installs explicitly attached
resources and skills, alongside seed files. Changing `cwd` does not relocate resources.
Conflicting files and symlinks fail instead of being overwritten.

Capture recursively excludes hidden files/directories, dependency folders,
`resource.ts`, package manifests/locks and private-key file extensions. It preserves
asset bytes and executable flags. Unsupported knowledge files fail validation.
The existing compiler limits apply: 128 captured files, 2 MiB source and bounded
compiled resource data. Large knowledge collections belong outside this Git snapshot.

Capture is performed by trusted source readers. Factories never read the host disk.
The compiled snapshot includes all captured data; historical runs/resumes do not
consult a newer resource directory. Resource edits require a new agent release.
SDK callbacks still run in bounded QuickJS without host filesystem/network access;
the browse/fill tools are fixed platform operations, not authored host callbacks.

## Run, edit and resume

Use the existing run API, client SDK and CLI with the same agent identity:

```http
POST /api/v1/runs
Authorization: Bearer <api-key>
Content-Type: application/json

{"target":"agents.invoice-reviewer","input":{"subtotal":100}}
```

The public authoring package defines agents; existing execution clients start and
inspect runs. A run captures the selected source definition and isolated tool
bundle. Human-review resumes retain that definition, conversation and remaining
guards. This PR adds neither `.asTool()` nor new conversational follow-up APIs.

In the UI, TypeScript source uses syntax highlighting. API/email enablement edits
change the `agent.ts` draft and take effect when that version is released. Source
edits preserve callback code and filesystem options; stale writes are rejected.
Literal options and top-level const definitions are supported; dynamic configuration
is refused safely and can be edited directly in source.
Email alias management retains its existing routing-management behavior.

Under the hood, the isolated compiler turns the TypeScript authoring definition
into validated runtime configuration and JSON Schemas, with tool code kept in a
separate isolated executable bundle. TypeScript remains the source of truth;
compiled data pins reproducible runs/resumes and lets non-TypeScript services
validate the same contracts. There is no cross-run compilation cache.

## Define evaluations

Keep datasets and documents in the existing dataset storage. An agent definition
contains reusable evaluation logic, not the dataset itself. Configure the agent
first, register named evaluators next, then finish with one pass decision.

This complete `agent.ts` starts with an empty workspace seeded with an invoice,
adds a synchronous calculation tool, and exports a weighted evaluation decision:

```ts
import {
  createAgent,
  createTool,
  exactDiff,
  llmJudge,
  weightedScore,
  maxTurns,
  maxTimeMs,
  maxCredits,
} from '@eigenpal/automations';
import { z } from 'zod';

const invoice = createAgent({
  name: 'Invoice reviewer',
  instructions:
    'Review the supplied invoice, call calculateTotal, and return the supplier, amounts, and a factual summary.',
  inputSchema: z.object({ invoice: z.string() }),
  outputSchema: z.strictObject({
    supplier: z.strictObject({ name: z.string(), taxId: z.string() }),
    amounts: z.strictObject({ subtotal: z.number(), tax: z.number(), total: z.number() }),
    summary: z.string(),
  }),
  tools: {
    calculateTotal: createTool({
      description: 'Calculate invoice tax and total from subtotal and tax rate.',
      inputSchema: z.object({ subtotal: z.number().nonnegative(), rate: z.number().nonnegative() }),
      outputSchema: z.strictObject({ tax: z.number(), total: z.number() }),
      execute: ({ subtotal, rate }) => {
        const tax = Math.round(subtotal * rate * 100) / 100;
        return { tax, total: subtotal + tax };
      },
    }),
  },
  guards: [maxTurns(10), maxTimeMs(60_000), maxCredits(100)],
}).withFilesystem({
  cwd: null,
  files: { 'invoice.txt': 'Supplier: Example Ltd; tax ID: EX123; subtotal: 100; tax rate: 0.2' },
});

// Finish configuration above before the first defineEvaluator call.
const evaluated = invoice
  .defineEvaluator(
    'fields',
    exactDiff({
      select: (output) => ({
        supplierTaxId: output.supplier?.taxId,
        total: output.amounts?.total,
      }),
      options: { rules: { total: { numericTolerance: 0.01 } } },
    })
  )
  .defineEvaluator(
    'meaning',
    llmJudge({
      prompt: 'Score whether the actual summary preserves the expected invoice facts.',
      select: ({ actual, expected }) => ({
        actual: actual.summary,
        expected: expected?.summary,
      }),
    })
  )
  .defineEvaluator('balanced', ({ actual }) =>
    Math.abs(actual.amounts.subtotal + actual.amounts.tax - actual.amounts.total) <= 0.01 ? 1 : 0
  );

export default evaluated.defineEvalPass(
  weightedScore({
    weights: { fields: 2, meaning: 1, balanced: 3 },
    threshold: 0.9,
  })
);

// Alternatively, replace the default export above with a boolean decision:
// export default evaluated.defineEvalPass(
//   ({ fields, meaning, balanced }) => balanced === 1 && fields === 1 && meaning >= 0.8
// );
```

No output types or evaluator score maps need manual annotations. In custom and
judge callbacks, `actual.amounts.total` is a `number`; `expected` can be absent,
and each nested expected field can also be absent. Use `expected?.amounts?.total`
when selecting a nested expected value. The exact selector runs on both actual
and partial expected outputs, so it uses `output.amounts?.total` even though the
actual output is complete. Optional chaining makes the selector type-safe; it
does not make missing expected values compare successfully. Supply the selected
expected fields in the dataset to avoid an evaluation error.

Pass callbacks only see registered score names. Misspelled output properties and
score names fail TypeScript checking. Use a Zod output schema for full inference;
raw JSON Schema and absent output schemas intentionally infer `unknown` and
require narrowing. Change tools, schemas, guards, or filesystem options on
`invoice` before registering evaluators; the `evaluated` chain only accepts more
evaluators and its final pass decision. Either pass branch returns a complete
agent definition that can be compiled.

### Authoring phases

All methods return new immutable definitions. The original base agent is reusable.

1. `createAgent` and `.withFilesystem` configure behavior.
2. The first `.defineEvaluator(name, evaluate)` closes configuration. Register up
   to 32 uniquely named evaluators. Names must be stable string literals, begin
   with a letter and contain only letters, digits, `_` or `-`, up to 64 characters.
   Prototype-related names are reserved. Runtime strings and unions are rejected
   by TypeScript because they cannot establish a reliable score registry.
3. One terminal `.defineEvalPass(predicateOrWeightedScore)` closes registration.
   Its result has no configuration, evaluator-registration or pass methods.
   An unfinished evaluator chain cannot be compiled or released.

Agents with no evaluation configuration require no pass rule. Evaluation-enabled
agents require an explicit decision; there is no implicit threshold. Evaluation
configuration works with filesystem and filesystem-free agents. Ordinary runs
never invoke evaluators automatically. Agent execution guards cover inference
and tool execution. Evaluation scripts have separate fixed execution limits;
model judging uses the existing evaluation model connection and billing.

### Evaluator callbacks

`defineEvaluator` takes a name and either a synchronous callback or helper:

- **Custom callback:** `({ actual, expected }) => number`. Return a finite score
  between 0 and 1. Inputs are deeply readonly. `actual` is the validated agent
  output; `expected` is optional and deeply partial because stored examples can
  omit expected fields. Conditional JSON Schema constraints (`if`, `not`, and
  dependent schemas) are refused for partial expectations rather than weakened. Use optional chaining or explicitly guard missing values.
- **`exactDiff({ select, options? })`:** applies the same synchronous projection
  to actual and expected outputs. `select` receives a deeply readonly partial
  output, so nested optional chaining is required where expected data can be
  absent. Return a JSON object, array or primitive. Selecting an object gives
  readable diagnostic labels. Missing expected data or undefined selected values
  cause an explicit evaluation error, rather than silently matching. Empty
  selections are rejected. Comparison reuses the platform comparator.
- **`llmJudge({ prompt, select, model? })`:** `select` receives typed
  `{ actual, expected }` and returns only the JSON data to expose to the judge.
  `prompt` is required, 10 to 131072 characters. `model` optionally selects a
  configured organization model; omission uses existing model selection. Dataset
  expected answers never become agent input. The worker calls the judge through
  model connections; selectors do not receive credentials.

Selectors must synchronously return JSON-compatible data. Promises, functions
and host objects are not supported. Callback code runs in the bounded script
runtime without ambient network, filesystem or host credentials. Errors,
timeouts, invalid scores and missing selected expected values are recorded as
evaluation errors and prevent an overall pass. Exceptions are never silently
skipped or counted as perfect scores.

Advanced `exactDiff.options` preserve existing comparison semantics:

- `rules`: a map of selected projection paths (or `$` for the entire projection)
  to comparison rules. Paths are inferred from the selected shape up to four
  nesting levels. Each rule supports `ignore: true`, `order: 'ordered' |
'unordered'`, `items: 'at-least' | 'at-most' | 'exactly'`, `matchBy` (relative
  item identity path or array of paths), `allowExtraFields`, and nonnegative
  `numericTolerance`. `matchBy` requires `order: 'unordered'`; ignore rules
  cannot contain other settings. Match identity candidates are inferred from selected
  array item shapes; the comparison engine validates their use on the actual array.
- For compatibility with existing comparison behavior, `paths`, `unorderedPaths`,
  `numericTolerance` and `allowExtraFields` remain available as global options.
  Do not combine them with `rules`. Path lists are inferred from the projection.

These options apply to the projection, not to the unselected original output.
Explicit `null` and empty strings in selected expected values are compared.
Omitted expected properties remain partial; selecting an undefined value is an
error. Numeric tolerance is an absolute difference. Omission preserves existing
comparison defaults, including historical relative numeric epsilon, allowed extra
object fields, and positional-prefix array matching. Use `items: 'exactly'` and
`allowExtraFields: false` when extra values must fail.

### A UI-friendly weighted decision

Use `weightedScore` when a weighted average is enough. In the complete example
above, the average is `(fields * 2 + meaning + balanced * 3) / 6`, with an inclusive
threshold of `0.9`. Only listed evaluators contribute.
Weights must reference registered names, be finite and nonnegative, with a
positive finite total. The threshold is inclusive and between 0 and 1. Unknown
names fail TypeScript checking and runtime validation. This descriptor can render
as ordinary weight/threshold controls in the UI. Predicate decisions render as
source with the overall verdict; individual scores and diagnostics remain
available in either form. Weighting is never silently applied to predicates.

A predicate receives the complete readonly score map and must synchronously
return `boolean`. Use ordinary `&&`, `||`, comparisons and arithmetic for custom
logic. A second pass definition, additional evaluator or filesystem change after
the pass is a type error and unavailable at runtime.
