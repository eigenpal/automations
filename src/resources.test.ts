import { expect, test } from 'bun:test';
import { compileAgent, resolveDirectoryResource } from './compiler';
import { createAgent, createKnowledge, createRule, createSkill, createTemplate } from './index';

test('directory declarations are tiny, immutable and resolved exclusively from compiler-supplied data', () => {
  const knowledge = createKnowledge({ name: 'VAT' });
  expect(Object.isFrozen(knowledge)).toBe(true);
  expect(knowledge).toEqual({ kind: 'knowledge', name: 'VAT' });
  const resolved = resolveDirectoryResource(knowledge, {
    'README.md': 'Use 20% tax.',
    'rates.csv': 'rate\n0.2',
  });
  const rule = resolveDirectoryResource(createRule({ name: 'Accuracy' }), {
    'RULE.md': 'Never invent amounts.',
  });
  const template = resolveDirectoryResource(createTemplate({ name: 'Summary' }), {
    'template.md': 'Total: {{total}}',
  });
  const agent = createAgent({
    name: 'Invoice',
    resources: { knowledge: resolved, rule, template },
  });
  expect(compileAgent(agent).tools?.resource_read).toBeDefined();
  expect(compileAgent(agent.withFilesystem()).resources).toEqual({
    knowledge: resolved,
    rule,
    template,
  });
  expect(() => compileAgent(createAgent({ name: 'Uncaptured', resources: { knowledge } }))).toThrow(
    'eigenpal agents validate'
  );
});
test('skills require filesystem but also work in an explicitly empty sandbox', () => {
  const skill = resolveDirectoryResource(createSkill({ name: 'Check' }), {
    'SKILL.md': 'Run scripts/check.py',
    'scripts/check.py': 'print(1)',
  });
  // @ts-expect-error skills are not portable resources
  expect(() => createAgent({ name: 'Invalid', resources: { skill } })).toThrow('Skills require');
  const agent = createAgent({ name: 'Empty' }).withFilesystem({
    cwd: null,
    skills: { check: skill },
  });
  expect(compileAgent(agent).resources?.check.files?.['scripts/check.py']).toBe('print(1)');
});
test('conventions fail clearly and do not accept two authoring interfaces', () => {
  // @ts-expect-error directory resources never enumerate their content
  expect(() => createKnowledge({ name: 'x', content: 'x' })).toThrow();
  expect(() => resolveDirectoryResource(createRule({ name: 'x' }), { 'README.md': 'x' })).toThrow(
    'RULE.md'
  );
  expect(() =>
    resolveDirectoryResource(createTemplate({ name: 'x' }), {
      'template.md': 'x',
      'template.docx': 'y',
    })
  ).toThrow('one template');
  expect(
    resolveDirectoryResource(createTemplate({ name: 'x', file: 'invoice.md' }), {
      'invoice.md': '{{total}}',
    }).entry
  ).toBe('invoice.md');
  expect(() =>
    resolveDirectoryResource(createKnowledge({ name: 'x' }), { 'run.js': 'throw 1' })
  ).toThrow('supports');
  expect(() =>
    resolveDirectoryResource(createTemplate({ name: 'x', file: '../x.md' }), {})
  ).toThrow();
  expect(() =>
    createAgent({ name: 'x', resources: { constructor: createKnowledge({ name: 'x' }) } })
  ).toThrow();
});

test('blank optional descriptions do not make directory resources unresolvable', () => {
  for (const description of ['', '   ']) {
    const template = resolveDirectoryResource(createTemplate({ name: 'Summary', description }), {
      'template.md': '{{total}}',
    });
    const knowledge = resolveDirectoryResource(createKnowledge({ name: 'Policy', description }), {
      'policy.md': 'Approved policy',
    });
    expect(template.content).toContain('template.md');
    expect(knowledge.content).toContain('knowledge');
  }
});
