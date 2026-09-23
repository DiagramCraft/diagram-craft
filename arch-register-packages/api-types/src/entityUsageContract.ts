import { z } from 'zod';

export const entityUsageKindSchema = z
  .enum(['entity', 'relation', 'document', 'project', 'diagram'])
  .describe('Type of resource that references the entity');

export const entityUsageSchema = z.object({
  kind: entityUsageKindSchema,
  id: z.string().describe('Identifier of the referencing resource'),
  label: z.string().describe('Display label of the referencing resource'),
  context: z.string().optional().describe('Field or relation context for the reference')
});

export const entityUsagePageSchema = z.object({
  items: z.array(entityUsageSchema).describe('Visible usage references in this page'),
  total: z.number().int().min(0).describe('Total number of visible usage references')
});

export type EntityUsage = z.infer<typeof entityUsageSchema>;
export type EntityUsagePage = z.infer<typeof entityUsagePageSchema>;
