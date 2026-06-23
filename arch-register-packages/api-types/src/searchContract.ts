import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, foreignKeySchema } from '@arch-register/api-types/common';
import { contentMetadataSchema } from '@arch-register/api-types/projectContract';

// ── Shared sub-schemas ────────────────────────────────────────

const projectSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(['draft', 'active', 'complete', 'cancelled'])
});

const fileSearchResultSchema = z.object({
  scope: z.enum(['project', 'entity', 'workspace']),
  projectId: z.string().nullable(),
  projectPublicId: z.string().nullable(),
  projectName: z.string().nullable(),
  entityId: z.string().nullable(),
  entityPublicId: z.string().nullable(),
  entityName: z.string().nullable(),
  fileId: z.string(),
  path: z.string(),
  name: z.string(),
  comment_count: z.number(),
  unresolved_comment_count: z.number(),
  content_metadata: contentMetadataSchema.nullable()
});

const entitySearchResultSchema = z.object({
  entityId: z.string(),
  publicId: z.string(),
  schemaId: z.string(),
  schemaName: z.string(),
  _name: z.string(),
  _slug: z.string(),
  _description: z.string(),
  _owner: foreignKeySchema.nullable(),
  _lifecycle: foreignKeySchema.nullable(),
  _targetLifecycle: foreignKeySchema.nullable(),
  matchedFields: z.array(z.string()),
  matchedMetadata: z.array(z.string())
});

const schemaFieldMatchSchema = z.object({
  fieldId: z.string(),
  fieldName: z.string()
});

const schemaSearchResultSchema = z.object({
  schemaId: z.string(),
  name: z.string(),
  fieldMatches: z.array(schemaFieldMatchSchema)
});

const searchResponseSchema = z.object({
  query: z.string(),
  projects: z.array(projectSearchResultSchema),
  files: z.array(fileSearchResultSchema),
  entities: z.array(entitySearchResultSchema),
  schemas: z.array(schemaSearchResultSchema)
});

// ── Contract ──────────────────────────────────────────────────

export const searchContract = {
  search: {
    query: oc
      .route({ method: 'GET', path: '/{workspace}/search', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          query: z.object({
            q: z.string().optional(),
            limitPerType: z.preprocess(
              v => (v !== undefined ? Number(v) : undefined),
              z.number().int().positive().optional()
            ),
            types: z.string().optional()
          })
        })
      )
      .output(searchResponseSchema)
  }
};
