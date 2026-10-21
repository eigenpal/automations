import { z } from 'zod';
import { executionGuardSchema } from './capabilities.js';

export const filesystemOptionsSchema = z
  .strictObject({
    cwd: z
      .string()
      .max(512)
      .refine(
        (value) => value === '.' || safePath(value),
        'Use a repository-relative directory containing only ASCII letters, digits, _, ., - and /, without traversal'
      )
      .nullable()
      .optional(),
    files: z
      .record(
        z
          .string()
          .refine(
            safePath,
            'Use a relative file path containing only ASCII letters, digits, _, ., - and /, without traversal'
          ),
        z.string()
      )
      .optional(),
    packages: z
      .strictObject({
        python: z
          .record(
            z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/),
            z.string().regex(/^[0-9]+(?:\.[0-9]+){1,3}$/)
          )
          .optional(),
        npm: z
          .record(
            z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
            z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/)
          )
          .optional(),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    const files = Object.entries(value.files ?? {});
    if (
      files.length > 100 ||
      files.reduce((total, [path, text]) => total + utf8Length(path + text), 0) > 256 * 1024
    )
      context.addIssue({
        code: 'custom',
        message: 'Workspace files allow at most 100 files and 256 KiB total',
      });
    if (
      Object.keys(value.packages?.python ?? {}).length +
        Object.keys(value.packages?.npm ?? {}).length >
      32
    )
      context.addIssue({
        code: 'custom',
        message: 'Workspace allows at most 32 additional packages',
      });
  });

// No host globals: the public SDK also runs inside the isolated source compiler.
function utf8Length(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function safePath(value: string): boolean {
  return (
    value.length <= 512 &&
    /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(value) &&
    !value
      .split('/')
      .some((part) =>
        ['.', '..', '.git', '.eigenpal', 'node_modules', 'eigenpal_modules'].includes(part)
      )
  );
}

// Deliberately no defaults: preserve omitted fields for the existing platform parser.
export const agentConfigSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.string().optional(),
  instructions: z
    .string()
    .min(1)
    .max(128 * 1024)
    .refine((v) => v.trim().length > 0)
    .optional(),
  filesystem: z.boolean().optional(),
  workspace: filesystemOptionsSchema.optional(),
  guards: z.array(executionGuardSchema).max(32).optional(),
  triggers: z
    .strictObject({
      api: z.boolean().optional(),
      email: z
        .strictObject({
          enabled: z.boolean().optional(),
          aliases: z
            .array(
              z.union([
                z.string().includes('@'),
                z.strictObject({
                  address: z.string().includes('@'),
                  allowlist: z.array(z.string()).optional(),
                  replyConfig: z.record(z.string(), z.json()).optional(),
                  requireSenderAuth: z.boolean().optional(),
                  enabled: z.boolean().optional(),
                }),
              ])
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
