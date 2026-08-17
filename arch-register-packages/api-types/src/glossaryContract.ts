import { oc } from '@orpc/contract';
import { z } from 'zod';
import { entityRecordSchema } from './entityContract';
import { foreignKeySchema, ws, wsAndId } from './common';

const glossaryConfigSchema = z.object({
  termSchemaId: z.string(),
  categorySchemaId: z.string(),
  fields: z.object({
    definition: z.string(),
    synonyms: z.string(),
    abbreviations: z.string(),
    categories: z.string(),
    status: z.string()
  })
});

const glossaryQualitySchema = z.object({
  unused: z.boolean(),
  conflicting: z.boolean(),
  deprecated: z.boolean(),
  ownerless: z.boolean()
});

const glossaryCategorySchema = foreignKeySchema.extend({
  public_id: z.string().nullable().optional()
});

const glossaryTermSchema = z.object({
  entity: entityRecordSchema,
  canonicalName: z.string(),
  aliases: z.array(z.string()),
  categories: z.array(glossaryCategorySchema),
  status: z.string().nullable(),
  usageCount: z.number().int().min(0),
  quality: glossaryQualitySchema
});

const glossaryUsageSchema = z.object({
  kind: z.enum(['entity', 'relation', 'document', 'project', 'diagram']),
  id: z.string(),
  label: z.string(),
  href: z.string().optional(),
  context: z.string().optional()
});

const glossaryReportKindSchema = z.enum(['unused', 'conflicting', 'deprecated', 'ownerless']);

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
                q: z.string().optional(),
                categoryIds: z.array(z.string()).optional(),
                owner: z.string().optional(),
                status: z.string().optional(),
                lifecycle: z.string().optional(),
                quality: glossaryReportKindSchema.optional(),
                limit: z.coerce.number().int().min(1).max(200).optional(),
                offset: z.coerce.number().int().min(0).optional()
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
        .input(z.object({ params: wsAndId }))
        .output(z.array(glossaryUsageSchema))
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
              limit: z.coerce.number().int().min(1).max(200).optional(),
              offset: z.coerce.number().int().min(0).optional()
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
