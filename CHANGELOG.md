# @eigenpal/automations

## 0.20.73

### Patch Changes

- 095515e: Allow immutable filesystem variants after evaluator and pass registration, preserve inferred evaluator and output types, and reject async/generator evaluation callbacks early. Document callback capabilities, limits and authoring checks.

## 0.20.71

### Minor Changes

- 28d79f3: Define agents with inline or file instructions, immutable .withFilesystem() variants with bounded seed files and exact sandbox packages, custom typed tools, working directories, and composable execution guards.

  Define knowledge, rules, templates and directory skills as imported TypeScript resources. Portable resource text works in both agent modes; skills require filesystem access. Capture resources at the agent release commit instead of maintaining unchecked version strings.

## 0.20.49

### Patch Changes

- 430b899: Agent definitions preserve explicitly unconstrained JSON schemas (`{}`), allowing existing agents to move to TypeScript without adding validation constraints.

## 0.20.48

### Minor Changes

- c14d0ad: The open-source TypeScript authoring SDK provides `createAgent`, typed input/output schemas, and a compiler for agent configuration. Existing agents continue running unchanged; TypeScript source integration follows separately.

### Patch Changes

- c236909: Preserve special JSON Schema keys during compilation without changing schema data.

## Unreleased

- Define agents in TypeScript and compile their configuration and schemas into portable JSON.
