import { z } from 'zod';

/** Binary assets are captured as data, never executed by resource declarations. */
export interface BinaryAsset {
  readonly encoding: 'base64';
  readonly content: string;
  readonly executable?: boolean;
}
export interface TextAsset {
  readonly encoding: 'utf8';
  readonly content: string;
  readonly executable?: boolean;
}
export type ResourceFile = string | BinaryAsset | TextAsset;
export type ResourceKind = 'knowledge' | 'rule' | 'template' | 'skill';
export interface ResourceDefinition<K extends ResourceKind = ResourceKind> {
  readonly kind: K;
  readonly name: string;
  readonly description?: string;
  /** Rule/skill instructions, or a knowledge/template catalog description. */
  readonly content: string;
  readonly entry?: string;
  readonly files?: Readonly<Record<string, ResourceFile>>;
}
export type PortableResource = ResourceDeclaration<'knowledge' | 'rule' | 'template'>;
export type Skill = ResourceDeclaration<'skill'>;

const path = z
  .string()
  .max(256)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.includes('\\') &&
      !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) &&
      value
        .split('/')
        .every(
          (part) =>
            !!part &&
            !['.', '..', '.git', '.eigenpal', 'eigenpal_modules', 'node_modules'].includes(part)
        ),
    'Use a resource-relative file path without traversal'
  );
export const resourceSchema = z.strictObject({
  kind: z.enum(['knowledge', 'rule', 'template', 'skill']),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  content: z
    .string()
    .min(1)
    .max(128 * 1024)
    .refine((value) => !!value.trim()),
  entry: path.optional(),
  files: z
    .record(
      path,
      z.union([
        z.string().max(256 * 1024),
        z.strictObject({
          encoding: z.literal('utf8'),
          content: z.string().max(256 * 1024),
          executable: z.boolean().optional(),
        }),
        z.strictObject({
          executable: z.boolean().optional(),
          encoding: z.literal('base64'),
          content: z
            .string()
            .max(512 * 1024)
            .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
        }),
      ])
    )
    .refine((files) => Object.keys(files).length <= 64, 'At most 64 resource files')
    .optional(),
});
export const resourceNameSchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/)
  .refine((name) => !['__proto__', 'constructor', 'prototype'].includes(name));
export const resourceMapSchema = z
  .record(resourceNameSchema, resourceSchema)
  .refine((resources) => Object.keys(resources).length <= 32, 'At most 32 resources')
  .refine(
    (resources) => JSON.stringify(resources).length <= 1024 * 1024,
    'Resource data exceeds 1 MiB'
  );

/** A directory declaration. The release compiler captures accompanying files. */
export interface DirectoryResource<K extends ResourceKind = ResourceKind> {
  readonly kind: K;
  readonly name: string;
  readonly description?: string;
  /** Optional template filename, relative to this resource directory. */
  readonly file?: string;
}
export type ResourceDeclaration<K extends ResourceKind = ResourceKind> =
  | DirectoryResource<K>
  | ResourceDefinition<K>;
const directoryOptions = z.strictObject({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
});
export const directoryResourceSchema = directoryOptions
  .extend({
    kind: z.enum(['knowledge', 'rule', 'template', 'skill']),
    file: path.optional(),
  })
  .refine((value) => !value.file || value.kind === 'template', 'Only templates accept file');
export const resourceDeclarationMapSchema = z
  .record(resourceNameSchema, z.union([resourceSchema, directoryResourceSchema]))
  .refine((resources) => Object.keys(resources).length <= 32);
function declare<K extends ResourceKind>(
  kind: K,
  options: { name: string; description?: string; file?: string }
): DirectoryResource<K> {
  const parsed = (
    kind === 'template' ? directoryOptions.extend({ file: path.optional() }) : directoryOptions
  ).parse(options);
  return Object.freeze({ ...parsed, kind });
}
/** Default-export from resource.ts; captures supported documents recursively from this directory at release. */
export const createKnowledge = (options: { name: string; description?: string }) =>
  declare('knowledge', options);
/** Default-export from resource.ts beside RULE.md, which enters the agent instructions. */
export const createRule = (options: { name: string; description?: string }) =>
  declare('rule', options);
/** Default-export from resource.ts beside one template.docx, template.xlsx or template.md; file overrides that convention. */
export const createTemplate = (options: { name: string; description?: string; file?: string }) =>
  declare('template', options);
/** Default-export from resource.ts beside SKILL.md and helpers. Attach through withFilesystem({ skills }). */
export const createSkill = (options: { name: string; description?: string }) =>
  declare('skill', options);
