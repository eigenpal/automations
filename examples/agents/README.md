# Agent authoring examples

Open this folder in your IDE. Start at `agents/invoice/agent.ts`, which selects the repository variant. All definitions use public SDK imports. Everything is synthetic; no customer data or credentials are included.

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
- `agents/invoice/variants/repository.ts`: `.withFilesystem()` uses the agent package folder and `AGENT.md`; local invoice/template files plus three pinned shared Git resources.
- `agents/invoice/variants/project-root.ts`: override `cwd`, seed a file, declare exact npm/Python sandbox library versions.
- `agents/invoice/variants/empty.ts`: `cwd: null` starts with only seeded files and no repository checkout.
- `agents/invoice/variants/evaluated.ts`: typed exact comparison, LLM judge, custom evaluator, weighted decision and an alternative boolean callback. Evaluations work with or without filesystem access. Configure filesystem before registering evaluators.
- `type-checks.ts`: intentional mistakes marked `@ts-expect-error`. Remove a comment to inspect the diagnostic.

Hover or request completion on tool inputs, evaluator output fields, optional expected values, weight keys, and pass callback score names. All come from the schema and evaluator chain. `maxCredits` limits model credits only; `maxTimeMs` bounds active compute time. Filesystem agents need a deployment with sandbox support; functional agents do not.

All helper imports stay inside `agents/invoice/`: the platform captures package-local modules, not arbitrary files elsewhere in the repository. To try another variant, change the import in `agents/invoice/agent.ts`. A local template or invoice already belongs to this package and is never listed as a shared dependency.

## Shared resources: two different kinds of reuse

**TypeScript code reuse:** import the tool and Zod schemas in `agents/invoice/shared/`. These are checked by TypeScript and bundled with this agent. A tool callback runs in the existing isolated script runtime, with no host filesystem/network access. Installing sandbox libraries does not grant that callback new permissions.

**Versioned organization resources:** `resources/skills/invoice-checks`, `resources/knowledge/tax-policy`, and `resources/rules/invoice-style` are separate Git packages. Their existing `eigenpal.yaml` metadata is intentional. They have not migrated to a TypeScript resource-definition API. The repository variant imports a constants map of exact version pins from `shared/resource-versions.ts`; that import centralizes versions but does not prove resource names or tags exist. The CLI validates and resolves them against Git. Do not mistake this for a new typed resource factory.

For a disposable local Git exercise, copy this example folder outside the SDK checkout, initialize it as a repository, commit the fixtures and create the three resource release tags:

```sh
git init -b main
git add .
git commit -m 'Add synthetic agent examples'
git tag -a resources.skills.invoice-checks@1.0.0 -m 'Release invoice checks'
git tag -a resources.knowledge.tax-policy@1.0.0 -m 'Release tax policy'
git tag -a resources.rules.invoice-style@1.0.0 -m 'Release invoice style'
cd agents/invoice
eigenpal agents install
eigenpal agents install --frozen-lockfile
```

Use the EigenPal CLI connected to a deployment running the matching SDK feature release. CLI installation requires access to that deployment's definition compiler; the IDE/typecheck exercises above do not. The tags in these commands are local synthetic tags, not releases in your organization. Copying this folder changes the `file:../..` dependency location; link it to your local built SDK or replace it with the matching published version when available.

Installation puts shared files below `agents/invoice/eigenpal_modules/resources/<kind>/<slug>/` and records exact resolved commits in `.eigenpal/eigenpal.lock`. Re-running with `--frozen-lockfile` verifies the pins. Local files and shared resources keep separate paths; they are not silently merged. Seed files are relative to the selected working directory; a differing existing file causes an error rather than being overwritten. `cwd: null` cannot be combined with shared file dependencies.

Datasets stay in platform storage. Evaluation selectors see the full actual output and optional, deeply partial expected output. Defining an LLM judge does not call a model during compilation; running an evaluation does.

See the SDK root README for every property, trigger configuration, limits and supported schema constraints. These examples belong to the release-synchronized public source mirror; they are not bundled into the runtime npm tarball.
