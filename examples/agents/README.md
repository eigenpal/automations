# Agent authoring examples

Open this folder in your IDE. Start at `agents/invoice/agent.ts`, which defines a filesystem agent with all four shared resource kinds. All definitions use public SDK imports. Everything is synthetic; no customer data or credentials are included.

## Set up and check

From the root of the automations SDK repository:

```sh
bun install
bun run build
cd examples/agents
bun install
bun run typecheck
bun run check
```

Node.js 22+ and Bun are required. The example depends on `file:../..` so it uses the SDK source snapshot you cloned, including unreleased changes. After updating the SDK, rebuild it before checking the examples. These commands compile definitions and check types; they do not launch agents, create releases, install Python libraries, or call models.

## What to explore

- `agents/invoice/variants/functional.ts`: no sandbox, inline instructions, Zod input/output, imported custom tool, API trigger, turn/time/model-credit guards.
- `agents/invoice/variants/repository.ts`: `.withFilesystem()` uses the agent package folder and `AGENT.md`; local invoice/template files plus imported knowledge, rules, template and directory skill.
- `agents/invoice/variants/project-root.ts`: override `cwd`, seed a file, declare exact npm/Python sandbox library versions.
- `agents/invoice/variants/empty.ts`: `cwd: null` starts with only seeded files and no repository checkout.
- `agents/invoice/variants/evaluated.ts`: typed exact comparison, LLM judge, custom evaluator, weighted decision and an alternative boolean callback. Evaluations work with or without filesystem access. Configure filesystem before registering evaluators.
- `type-checks.ts`: intentional mistakes marked `@ts-expect-error`. Remove a comment to inspect the diagnostic.

Hover or request completion on tool inputs, evaluator output fields, optional expected values, weight keys, and pass callback score names. All come from the schema and evaluator chain. `maxCredits` limits model credits only; `maxTimeMs` bounds active compute time. Filesystem agents need a deployment with sandbox support; functional agents do not.

Definition imports may refer to local agent code or the project `resources/` tree.
The compiler captures this static graph at the agent release commit. To explore
another variant, open it directly; keep a literal `createAgent` call in `agent.ts`
for Studio's draft configuration editing.

## Shared resources

Each resource is defined and default exported by `resource.ts`. Open:

- `resources/knowledge/tax-policy/resource.ts`: imported policy text, usable by either agent mode.
- `resources/rules/invoice-style/resource.ts`: reusable instructions, usable by either mode.
- `resources/templates/invoice-summary/resource.ts`: a text contract plus the original DOCX bytes. Ordinary agents use the text; filesystem agents can fill the document.
- `resources/skills/invoice-checks/resource.ts`: `SKILL.md`, a Python helper and a binary fixture. Skills require `.withFilesystem({ skills: { checks } })`.

Use `resources: { policy, style, summary }` on `createAgent`, then optionally
`.withFilesystem({ skills: { checks } })`. Imports provide IDE navigation and
catch misspelled paths; the agent's release commit pins everything, with no string
version map. A resource edit needs a new agent release to affect production.

Skill files remain a directory. The sandbox installs them under
`/workspace/agent/.eigenpal-resources/checks/`; helpers are relative to that folder.
Knowledge, rules and template text are compiled into both modes' instructions.
Binary bytes never enter the prompt. `cwd` changes the initial work location,
while resource assets retain their explicit namespace. Seed `files` are relative
to cwd and differing existing files cause an error. `cwd: null` starts with only
seed files, retains portable resource text and rejects skills.

TypeScript tools in `agents/invoice/shared/` are ordinary code imports.
Their synchronous callbacks run in the bounded isolated script runtime, without
host filesystem, network or credentials. Installing sandbox Python/npm libraries
does not change those callback permissions.

To run against a deployment with this feature, release `agents/invoice` and use
the normal API, SDK or CLI. CLI validation/installation requires access to that
deployment's isolated compiler. The local `typecheck` and `check` commands above
require no deployment or credentials and perform no model calls.

Datasets stay in platform storage. Evaluation selectors see the full actual output and optional, deeply partial expected output. Defining an LLM judge does not call a model during compilation; running an evaluation does.

See the SDK root README for every property, trigger configuration, limits and supported schema constraints. These examples belong to the release-synchronized public source mirror; they are not bundled into the runtime npm tarball.
