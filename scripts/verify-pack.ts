import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dir, '..');
const temporary = mkdtempSync(join(tmpdir(), 'eigenpal-authoring-pack-'));
function run(command: string[], cwd = root): string {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0)
    throw new Error(`${command[0]} failed: ${result.stderr.toString()}${result.stdout.toString()}`);
  return result.stdout.toString();
}

try {
  rmSync(join(root, 'dist'), { recursive: true, force: true });
  run(['bun', 'run', 'build']);
  const [pack] = JSON.parse(
    run(['npm', 'pack', '--json', '--ignore-scripts', '--pack-destination', temporary])
  );
  for (const { path } of pack.files as { path: string }[]) {
    const allowed =
      ['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md'].includes(path) ||
      (path.startsWith('dist/') && !path.includes('test'));
    if (!allowed || path.startsWith('dist/migration.'))
      throw new Error(`Unexpected package file: ${path}`);
  }
  const destination = join(temporary, 'node_modules/@eigenpal/automations');
  mkdirSync(destination, { recursive: true });
  run(['tar', '-xzf', join(temporary, pack.filename), '--strip-components=1', '-C', destination]);
  symlinkSync(
    dirname(fileURLToPath(import.meta.resolve('zod/package.json'))),
    join(temporary, 'node_modules/zod'),
    'dir'
  );
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(
    join(temporary, 'consumer.ts'),
    `
import { z } from 'zod';
import { createAgent, type InferInput } from '@eigenpal/automations';
import { compileAgent } from '@eigenpal/automations/compiler';
const agent = createAgent({ name: 'Consumer', inputSchema: z.object({ text: z.string() }) });
const input: InferInput<typeof agent> = { text: 'hello' };
// @ts-expect-error published declarations must preserve required input fields
const invalid: InferInput<typeof agent> = {};
compileAgent(agent);
void input;
void invalid;
`
  );
  run(
    [
      'node',
      fileURLToPath(import.meta.resolve('typescript/bin/tsc')),
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'consumer.ts',
    ],
    temporary
  );
  run(
    [
      'node',
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import { createAgent } from '@eigenpal/automations';
    import { compileAgent } from '@eigenpal/automations/compiler';
    const compiled = compileAgent(createAgent({ name: 'Consumer' }));
    assert.deepEqual(compiled.manifest, { schemaVersion: 1, name: 'Consumer' });
    const unconstrained = compileAgent(createAgent({name:'Unconstrained',inputSchema:{},outputSchema:{}}));
    assert.deepEqual(unconstrained.inputSchema,{});
    assert.deepEqual(unconstrained.outputSchema,{});
    await assert.rejects(import('@eigenpal/automations/migration'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  `,
    ],
    temporary
  );
  const manifest = JSON.parse(readFileSync(join(destination, 'package.json'), 'utf8'));
  if (manifest.dependencies)
    throw new Error('Authoring package must not depend on platform packages');
  console.log('Packed package: Node ESM imports and standalone TypeScript consumer passed');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
