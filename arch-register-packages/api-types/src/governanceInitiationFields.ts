import { z } from 'zod';

const requirementLevelSchema = z.enum(['required', 'optional']);

const baseFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  requirementLevel: requirementLevelSchema
});

const enumOptionSchema = z.object({
  value: z.string(),
  label: z.string()
});

export const governanceInitiationFieldSchema = z
  .union([
    baseFieldSchema.extend({ type: z.literal('text') }),
    baseFieldSchema.extend({
      type: z.literal('rating'),
      max: z.number().int().min(2).max(10).optional()
    }),
    baseFieldSchema
      .extend({
        type: z.literal('enum'),
        enumId: z.string().min(1).optional(),
        options: z.array(enumOptionSchema).min(1).optional()
      })
      .superRefine((field, ctx) => {
        if (!field.enumId && !field.options) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options'],
            message: 'Enum initiation fields require enumId or options'
          });
        }
        if (field.enumId && field.options) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options'],
            message: 'Enum initiation fields cannot define enumId and inline options together'
          });
        }
      })
  ])
  .describe('Assessment-compatible governance initiation field definition');

export const governanceInitiationFieldValueSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['text', 'rating', 'enum']),
  requirementLevel: requirementLevelSchema,
  max: z.number().int().min(2).max(10).optional(),
  enumId: z.string().optional(),
  options: z.array(enumOptionSchema).optional(),
  value: z.unknown().nullable()
});

export type GovernanceInitiationField = z.infer<typeof governanceInitiationFieldSchema>;
export type GovernanceInitiationFieldValue = z.infer<typeof governanceInitiationFieldValueSchema>;
