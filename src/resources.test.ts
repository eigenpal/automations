import { expect, test } from 'bun:test';
import { z } from 'zod';
import { compileAgent } from './compiler';
import {
  createAgent,
  createKnowledge,
  createRule,
  createSkill,
  createTemplate,
  exactDiff,
} from './index';

test('portable resources are immutable typed definitions in either execution mode', () => {
  const knowledge = createKnowledge({ name: 'VAT', content: 'Use 20% tax.' });
  const rule = createRule({ name: 'Accuracy', content: 'Never invent amounts.' });
  const template = createTemplate({
    name: 'Summary',
    content: 'Total: {{total}}',
    files: { 'template.docx': { encoding: 'base64', content: 'AAH/AA==' } },
  });
  const agent = createAgent({
    name: 'Invoice',
    resources: { knowledge, rule, template },
    outputSchema: z.object({ total: z.number() }),
  });
  expect(Object.isFrozen(agent.resources?.template.files)).toBe(true);
  for (const variant of [agent, agent.withFilesystem()]) {
    expect(compileAgent(variant).resources).toEqual({ knowledge, rule, template });
  }
  const evaluated = agent
    .defineEvaluator('total', exactDiff({ select: (output) => output.total }))
    .defineEvalPass(({ total }) => total === 1);
  expect(compileAgent(evaluated).resources?.knowledge.content).toBe('Use 20% tax.');
});

test('skills require an explicit filesystem capability and preserve their asset files', () => {
  const skill = createSkill({
    name: 'Check',
    content: 'Run scripts/check.py',
    files: { 'scripts/check.py': 'print(1)' },
  });
  // @ts-expect-error directory skills do not belong to the portable resource map
  expect(() => createAgent({ name: 'Invalid', resources: { skill } })).toThrow('Skills require');
  const agent = createAgent({ name: 'Invoice' }).withFilesystem({ skills: { check: skill } });
  expect(compileAgent(agent).resources?.check.files?.['scripts/check.py']).toBe('print(1)');
  expect(() =>
    createAgent({ name: 'Empty' }).withFilesystem({ cwd: null, skills: { skill } })
  ).toThrow('Empty workspaces');
});

test('resource files and names cannot escape their namespace or overflow compilation', () => {
  expect(() => createRule({ name: 'Rule', content: 'x', files: { '../escape': 'x' } })).toThrow();
  expect(() =>
    createTemplate({
      name: 'Template',
      content: 'x',
      files: { 'file.bin': { encoding: 'base64', content: 'not base64!' } },
    })
  ).toThrow();
  expect(() =>
    createAgent({
      name: 'Invalid',
      resources: { constructor: createKnowledge({ name: 'x', content: 'x' }) },
    })
  ).toThrow();
});
