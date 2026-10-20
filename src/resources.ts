import { z } from 'zod';

/** Binary assets are imported as data, never executed or read by author callbacks. */
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
  /** Portable text: reference content, rule instructions, template text, or SKILL.md. */
  readonly content: string;
  readonly files?: Readonly<Record<string, ResourceFile>>;
}
export type PortableResource = ResourceDefinition<'knowledge' | 'rule' | 'template'>;
export type Skill = ResourceDefinition<'skill'>;

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

export type ResourceOptions<K extends ResourceKind> = Omit<
  ResourceDefinition<K>,
  'kind' | 'files'
> & {
  files?: Readonly<
    Record<
      string,
      | ResourceFile
      | Uint8Array
      | { readonly content: string | Uint8Array; readonly executable?: boolean }
    >
  >;
};
function encodeAsset(bytes: Uint8Array): BinaryAsset {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let content = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const value = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    content +=
      chars[(value >>> 18) & 63]! +
      chars[(value >>> 12) & 63]! +
      (i + 1 < bytes.length ? chars[(value >>> 6) & 63]! : '=') +
      (i + 2 < bytes.length ? chars[value & 63]! : '=');
  }
  return { encoding: 'base64', content };
}
function create<K extends ResourceKind>(
  kind: K,
  options: ResourceOptions<K>
): ResourceDefinition<K> {
  const files =
    options.files &&
    Object.fromEntries(
      Object.entries(options.files).map(([name, value]) => {
        if (value instanceof Uint8Array) return [name, encodeAsset(value)];
        if (typeof value === 'object' && value.content instanceof Uint8Array)
          return [
            name,
            {
              ...encodeAsset(value.content),
              ...(value.executable === undefined ? {} : { executable: value.executable }),
            },
          ];
        if (typeof value === 'object' && !('encoding' in value))
          return [name, { ...value, encoding: 'utf8' }];
        return [name, value];
      })
    );
  const parsed = resourceSchema.parse({ ...options, ...(files ? { files } : {}), kind });
  const reserved = 'SKILL.md';
  if (kind === 'skill' && parsed.files && Object.hasOwn(parsed.files, reserved))
    throw new Error('Resource files cannot override their content entry');
  if (parsed.files) {
    for (const file of Object.values(parsed.files))
      if (typeof file === 'object') Object.freeze(file);
    Object.freeze(parsed.files);
  }
  return Object.freeze(parsed) as ResourceDefinition<K>;
}
export const createKnowledge = (options: ResourceOptions<'knowledge'>) =>
  create('knowledge', options);
export const createRule = (options: ResourceOptions<'rule'>) => create('rule', options);
export const createTemplate = (options: ResourceOptions<'template'>) => create('template', options);
export const createSkill = (options: ResourceOptions<'skill'>): Skill => create('skill', options);
