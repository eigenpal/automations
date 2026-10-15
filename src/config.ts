import { z } from 'zod';

const segment = '[a-z0-9][a-z0-9_-]*';
const exactVersion = z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/);
const dependencyName = z
  .string()
  .regex(new RegExp(`^workspace:(agents|resources)\\.${segment}(\\.${segment})*$`));
const evaluatorName = z
  .string()
  .refine(
    (value) =>
      (value.startsWith('./evaluators/') &&
        value.endsWith('.yaml') &&
        !value.includes('..') &&
        !value.includes('\\')) ||
      new RegExp(`^workspace:evaluators\\.${segment}(\\.${segment})*$`).test(value),
    'Use ./evaluators/<file>.yaml or workspace:evaluators.<name>'
  );
const evaluatorItem = z
  .strictObject({
    use: evaluatorName,
    weight: z.number().min(0).optional(),
    version: exactVersion.optional(),
  })
  .superRefine((item, context) => {
    if (item.use.startsWith('workspace:') && !item.version)
      context.addIssue({
        code: 'custom',
        path: ['version'],
        message: 'Shared evaluators require an exact version',
      });
    if (item.use.startsWith('./') && item.version !== undefined)
      context.addIssue({
        code: 'custom',
        path: ['version'],
        message: 'Local evaluators do not take a version',
      });
  });

// Deliberately no defaults: preserve omitted fields for the existing platform parser.
export const agentConfigSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.string().optional(),
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
  dependencies: z.record(dependencyName, exactVersion).optional(),
  evaluators: z
    .strictObject({
      passThreshold: z.number().min(0).max(1).optional(),
      items: z.array(evaluatorItem).optional(),
    })
    .optional(),
});
