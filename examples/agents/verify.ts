import { compileAgent } from '@eigenpal/automations/compiler';
import empty from './agents/invoice/variants/empty.js';
import evaluated, { customPass } from './agents/invoice/variants/evaluated.js';
import functional from './agents/invoice/variants/functional.js';
import projectRoot from './agents/invoice/variants/project-root.js';
import repository from './agents/invoice/variants/repository.js';

const definitions = [functional, repository, projectRoot, empty, evaluated, customPass].map(
  (definition) => compileAgent(definition)
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
console.log(
  'PASS: six agent definitions, imported shared resources, filesystem modes and both evaluation decisions. No agents or model calls were executed.'
);
