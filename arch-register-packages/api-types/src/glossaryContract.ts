import { oc } from '@orpc/contract';
import { z } from 'zod';
import { entityRecordSchema } from './entityContract';
import { foreignKeySchema, ws, wsAndId } from './common';

export const glossaryConfigSchema = z.object({
  termSchemaId: z.string().describe('Schema identifier used for glossary terms'),
  categorySchemaId: z.string().describe('Schema identifier used for glossary categories'),
  fields: z.object({
    definition: z.string().describe('Term field identifier containing the definition'),
    synonyms: z.string().describe('Term field identifier containing synonyms'),
    abbreviations: z.string().describe('Term field identifier containing abbreviations'),
    categories: z.string().describe('Term field identifier containing category references'),
    status: z.string().describe('Term field identifier containing the status')
  })
});

export const glossaryQualitySchema = z.object({
  unused: z.boolean().describe('No visible references were found'),
  conflicting: z.boolean().describe('The name or an alias is shared by another term'),
  deprecated: z.boolean().describe('The term uses the deprecated lifecycle state'),
  ownerless: z.boolean().describe('The term has no owner')
});

export const glossaryCategorySchema = foreignKeySchema.extend({
  public_id: z.string().nullable().optional().describe('Public identifier for the category')
});

export const glossaryTermSchema = z.object({
  entity: entityRecordSchema.describe('The underlying catalog entity'),
  canonicalName: z.string().describe('Canonical display name for the term'),
  aliases: z.array(z.string()).describe('Synonyms and abbreviations for the term'),
  categories: z.array(glossaryCategorySchema).describe('Categories assigned to the term'),
  status: z.string().nullable().describe('Configured term status, if present'),
  usageCount: z.number().int().min(0).describe('Number of visible usage references'),
  quality: glossaryQualitySchema.describe('Computed glossary quality indicators')
});

export const glossaryUsageSchema = z.object({
  kind: z
    .enum(['entity', 'relation', 'document', 'project', 'diagram'])
    .describe('Type of resource that references the term'),
  id: z.string().describe('Identifier of the referencing resource'),
  label: z.string().describe('Display label of the referencing resource'),
  context: z.string().optional().describe('Field or relation context for the reference')
});

export const glossaryUsagePageSchema = z.object({
  items: z.array(glossaryUsageSchema).describe('Visible usage references in this page'),
  total: z.number().int().min(0).describe('Total number of visible usage references')
});

export const glossaryReportKindSchema = z
  .enum(['unused', 'conflicting', 'deprecated', 'ownerless'])
  .describe('Quality report to run');

export const glossaryContract = oc.tag('Glossary').router({
  glossary: {
    config: oc
      .route({
        method: 'GET',
        path: '/{workspace}/glossary/config',
        inputStructure: 'detailed',
        summary: 'Get glossary configuration',
        description: 'Returns the resolved business glossary capability binding.',
        tags: ['Glossary']
      })
      .input(z.object({ params: ws }))
      .output(glossaryConfigSchema.nullable()),
    terms: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/glossary/terms',
          inputStructure: 'detailed',
          summary: 'List glossary terms',
          description: 'Lists visible terms with alias-aware search and quality filters.',
          tags: ['Glossary']
        })
        .input(
          z.object({
            params: ws,
            query: z
              .object({
                q: z.string().optional().describe('Case-insensitive name or alias search'),
                categoryIds: z
                  .array(z.string())
                  .optional()
                  .describe('Only terms assigned to one of these categories'),
                owner: z.string().optional().describe('Exact owner identifier'),
                status: z.string().optional().describe('Exact configured status'),
                lifecycle: z.string().optional().describe('Exact lifecycle identifier'),
                quality: glossaryReportKindSchema.optional(),
                limit: z.coerce
                  .number()
                  .int()
                  .min(1)
                  .max(200)
                  .optional()
                  .describe('Maximum number of terms to return'),
                offset: z.coerce
                  .number()
                  .int()
                  .min(0)
                  .optional()
                  .describe('Number of matching terms to skip')
              })
              .optional()
          })
        )
        .output(z.object({ items: z.array(glossaryTermSchema), total: z.number().int().min(0) })),
      get: oc
        .route({
          method: 'GET',
          path: '/{workspace}/glossary/terms/{id}',
          inputStructure: 'detailed',
          summary: 'Get a glossary term',
          description: 'Returns a visible term with categories and quality metadata.',
          tags: ['Glossary']
        })
        .input(z.object({ params: wsAndId }))
        .output(glossaryTermSchema),
      usage: oc
        .route({
          method: 'GET',
          path: '/{workspace}/glossary/terms/{id}/usage',
          inputStructure: 'detailed',
          summary: 'List glossary term usage',
          description: 'Returns permission-filtered explicit references to a term.',
          tags: ['Glossary']
        })
        .input(
          z.object({
            params: wsAndId,
            query: z
              .object({
                limit: z.coerce
                  .number()
                  .int()
                  .min(1)
                  .max(200)
                  .optional()
                  .describe('Maximum number of usage references to return'),
                offset: z.coerce
                  .number()
                  .int()
                  .min(0)
                  .optional()
                  .describe('Number of usage references to skip')
              })
              .optional()
          })
        )
        .output(glossaryUsagePageSchema)
    },
    reports: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/glossary/reports',
          inputStructure: 'detailed',
          summary: 'List glossary quality reports',
          description: 'Lists visible terms matching a glossary quality report.',
          tags: ['Glossary']
        })
        .input(
          z.object({
            params: ws,
            query: z.object({
              kind: glossaryReportKindSchema,
              limit: z.coerce
                .number()
                .int()
                .min(1)
                .max(200)
                .optional()
                .describe('Maximum number of report terms to return'),
              offset: z.coerce
                .number()
                .int()
                .min(0)
                .optional()
                .describe('Number of matching report terms to skip')
            })
          })
        )
        .output(z.object({ items: z.array(glossaryTermSchema), total: z.number().int().min(0) }))
    }
  }
});

export type GlossaryConfig = z.infer<typeof glossaryConfigSchema>;
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;
export type GlossaryUsage = z.infer<typeof glossaryUsageSchema>;
export type GlossaryUsagePage = z.infer<typeof glossaryUsagePageSchema>;
