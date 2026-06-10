import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

const foreignKeySchema = z.object({
  id: z.string(),
  name: z.string()
});

const projectSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(['pinned', 'active', 'archived'])
});

const fileSearchResultSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  fileId: z.string(),
  path: z.string(),
  name: z.string()
});

const entitySearchResultSchema = z.object({
  entityId: z.string(),
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

// ── Request schemas ───────────────────────────────────────────

const searchRequestSchema = z.object({
  workspace: z.string(),
  q: z.string().optional(),
  limitPerType: z.preprocess(
    v => (v !== undefined ? Number(v) : undefined),
    z.number().int().positive().optional()
  ),
  types: z.string().optional()
});

// ── Contract ──────────────────────────────────────────────────

export const searchContract = {
  search: {
    query: oc
      .route({ method: 'GET', path: '/{workspace}/search' })
      .input(searchRequestSchema)
      .output(searchResponseSchema)
  }
};
