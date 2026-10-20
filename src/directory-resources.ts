import {
  directoryResourceSchema,
  resourceSchema,
  type DirectoryResource,
  type ResourceDefinition,
  type ResourceFile,
  type ResourceKind,
} from './resources.js';

/** Resolve only compiler-supplied data. Never reads the host filesystem. */
export function resolveDirectoryResource<K extends ResourceKind>(
  declaration: DirectoryResource<K>,
  files: Record<string, ResourceFile>
): ResourceDefinition<K> {
  const resource = directoryResourceSchema.parse(declaration);
  const names = Object.keys(files).sort();
  const text = (name: string): string => {
    const value = files[name];
    if (typeof value === 'string') return value;
    if (value?.encoding === 'utf8') return value.content;
    throw new Error(`Expected UTF-8 resource file: ${name}`);
  };
  let entry: string | undefined;
  let content: string;
  if (resource.kind === 'rule' || resource.kind === 'skill') {
    entry = resource.kind === 'rule' ? 'RULE.md' : 'SKILL.md';
    content = text(entry);
  } else if (resource.kind === 'template') {
    const candidates = resource.file
      ? [resource.file]
      : names.filter((name) => /^template\.(docx|xlsx|md)$/.test(name));
    if (candidates.length !== 1 || !Object.hasOwn(files, candidates[0]!))
      throw new Error(
        'Provide one template.docx, template.xlsx or template.md, or select file explicitly'
      );
    entry = candidates[0]!;
    if (!/\.(docx|xlsx|md)$/.test(entry)) throw new Error('Unsupported template format');
    content = resource.description ?? `Inspect and fill ${entry} with the template tools.`;
  } else {
    if (!names.length) throw new Error('Knowledge directory has no documents');
    if (names.some((name) => !/\.(md|txt|csv|json|pdf|docx|xlsx)$/i.test(name)))
      throw new Error('Knowledge supports Markdown, text, CSV, JSON, PDF, DOCX and XLSX documents');
    content = resource.description ?? 'Browse, search and read the attached knowledge documents.';
  }
  const assets = Object.fromEntries(
    Object.entries(files).filter(([name]) => resource.kind !== 'skill' || name !== 'SKILL.md')
  );
  return Object.freeze(
    resourceSchema.parse({
      kind: resource.kind,
      name: resource.name,
      ...(resource.description ? { description: resource.description } : {}),
      content,
      ...(entry ? { entry } : {}),
      files: assets,
    })
  ) as ResourceDefinition<K>;
}
