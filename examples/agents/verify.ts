import type { ResourceDefinition, ResourceFile } from '@eigenpal/automations';
import { compileAgent, resolveDirectoryResource } from '@eigenpal/automations/compiler';
import { Glob } from 'bun';

// Verification harness only: the deployment compiler performs directory capture for real runs.
const resolved = new Map<string, ResourceDefinition>();
const resourceDirectories = {
  policy: 'resources/knowledge/tax-policy/',
  style: 'resources/rules/invoice-style/',
  summary: 'resources/templates/invoice-summary/',
  checks: 'resources/skills/invoice-checks/',
};
for (const [alias, directory] of Object.entries(resourceDirectories)) {
  const path = directory + 'resource.ts';
  const declaration = (await import('./' + path)).default;
  const files: Record<string, ResourceFile> = {};
  for await (const name of new Glob('**/*').scan({
    cwd: import.meta.dir + '/' + directory,
    onlyFiles: true,
  })) {
    if (name === 'resource.ts') continue;
    const file = Bun.file(import.meta.dir + '/' + directory + name);
    files[name] = /\.(md|txt|csv|json|py|js|ts)$/.test(name)
      ? await file.text()
      : { encoding: 'base64', content: Buffer.from(await file.arrayBuffer()).toString('base64') };
  }
  resolved.set(alias, resolveDirectoryResource(declaration, files));
}

import empty from './agents/invoice/variants/empty.ts';
import evaluated, { customPass, filesystemEvaluated } from './agents/invoice/variants/evaluated.ts';
import functional from './agents/invoice/variants/functional.ts';
import projectRoot from './agents/invoice/variants/project-root.ts';
import repository from './agents/invoice/variants/repository.ts';

const definitions = [
  functional,
  repository,
  projectRoot,
  empty,
  evaluated,
  customPass,
  filesystemEvaluated,
].map((definition) =>
  compileAgent({
    ...definition,
    resources: Object.fromEntries(
      Object.keys(definition.resources ?? {}).map((alias) => [alias, resolved.get(alias)!])
    ),
  })
);
function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
check(definitions[0]!.manifest.filesystem === false, 'Functional agent must not require a sandbox');
check(definitions[1]!.manifest.filesystem === true, 'Repository agent must opt into a sandbox');
check(definitions[1]!.manifest.workspace?.cwd === undefined, 'Default cwd must remain omitted');
check(
  Object.keys(definitions[1]!.resources ?? {}).length === 4,
  'All four resources must survive compilation'
);
check(
  definitions[2]!.manifest.workspace?.cwd === '.',
  'Project root override must survive compilation'
);
check(definitions[3]!.manifest.workspace?.cwd === null, 'Empty workspace must remain explicit');
check(definitions[4]!.evaluation?.pass.kind === 'weighted', 'Weighted decision must compile');
check(definitions[5]!.evaluation?.pass.kind === 'callback', 'Custom decision must compile');
check(
  definitions[6]!.manifest.filesystem === true,
  'Evaluated agent must gain sandbox capabilities'
);
check(
  JSON.stringify(definitions[6]!.evaluation) === JSON.stringify(definitions[4]!.evaluation),
  'Filesystem variant must retain all evaluators and its pass rule'
);
console.log(
  'PASS: seven agent definitions, imported shared resources, filesystem modes and both evaluation decisions. No agents or model calls were executed.'
);
