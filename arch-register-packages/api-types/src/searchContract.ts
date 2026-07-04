import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, foreignKeySchema } from '@arch-register/api-types/common';
import { contentMetadataSchema } from '@arch-register/api-types/projectContract';

// ── Shared sub-schemas ────────────────────────────────────────

const projectSearchResultSchema = z.object({
  id: z.string().describe('Project identifier'),
  name: z.string().describe('Project name'),
  description: z.string().describe('Project description'),
  status: z.enum(['draft', 'active', 'complete', 'cancelled']).describe('Project status')
});

const fileSearchResultSchema = z.object({
  scope: z.enum(['project', 'entity', 'workspace']).describe('Scope where the file is located'),
  projectId: z.string().nullable().describe('Project identifier (if scope is project)'),
  projectPublicId: z.string().nullable().describe('Public project identifier (if scope is project)'),
  projectName: z.string().nullable().describe('Project name (if scope is project)'),
  entityId: z.string().nullable().describe('Entity identifier (if scope is entity)'),
  entityPublicId: z.string().nullable().describe('Public entity identifier (if scope is entity)'),
  entityName: z.string().nullable().describe('Entity name (if scope is entity)'),
  fileId: z.string().describe('File identifier'),
  path: z.string().describe('File path'),
  name: z.string().describe('File name'),
  comment_count: z.number().describe('Total number of comments on the file'),
  unresolved_comment_count: z.number().describe('Number of unresolved comments'),
  content_metadata: contentMetadataSchema.nullable().describe('File content metadata (for diagrams)')
});

const entitySearchResultSchema = z.object({
  entityId: z.string().describe('Entity identifier'),
  publicId: z.string().describe('Public entity identifier'),
  schemaId: z.string().describe('Schema identifier'),
  schemaName: z.string().describe('Schema name'),
  _name: z.string().describe('Entity name'),
  _slug: z.string().describe('Entity URL slug'),
  _description: z.string().describe('Entity description'),
  _owner: foreignKeySchema.nullable().describe('Entity owner'),
  _lifecycle: foreignKeySchema.nullable().describe('Current lifecycle state'),
  _targetLifecycle: foreignKeySchema.nullable().describe('Target lifecycle state'),
  matchedFields: z.array(z.string()).describe('Field IDs that matched the search query'),
  matchedMetadata: z.array(z.string()).describe('Metadata fields that matched the search query')
});

const schemaFieldMatchSchema = z.object({
  fieldId: z.string().describe('Field identifier'),
  fieldName: z.string().describe('Field name')
});

const schemaSearchResultSchema = z.object({
  schemaId: z.string().describe('Schema identifier'),
  name: z.string().describe('Schema name'),
  fieldMatches: z.array(schemaFieldMatchSchema).describe('Fields that matched the search query')
});

const searchResponseSchema = z.object({
  query: z.string().describe('The search query that was executed'),
  projects: z.array(projectSearchResultSchema).describe('Matching projects'),
  files: z.array(fileSearchResultSchema).describe('Matching files (diagrams, markdown, etc.)'),
  entities: z.array(entitySearchResultSchema).describe('Matching entities'),
  schemas: z.array(schemaSearchResultSchema).describe('Matching schemas')
});

// ── Contract ──────────────────────────────────────────────────

export const searchContract = oc
  .tag('Search')
  .router({
    search: {
      query: oc
        .route({
          method: 'GET',
          path: '/{workspace}/search',
          inputStructure: 'detailed',
          summary: 'Search workspace content',
          description: 'Performs a full-text search across projects, files, entities, and schemas within the workspace. Returns results grouped by type with configurable limits per type.',
          tags: ['Search']
        })
        .input(
          z.object({
            params: ws,
            query: z.object({
              q: z.string().optional().describe('Search query string'),
              limitPerType: z.preprocess(
                v => (v !== undefined ? Number(v) : undefined),
                z.number().int().positive().optional().describe('Maximum number of results per type (default varies by type)')
              ),
              types: z.string().optional().describe('Comma-separated list of types to search (projects, files, entities, schemas)')
            })
          })
        )
        .output(searchResponseSchema)
    }
  });

export type ProjectSearchResult = z.infer<typeof projectSearchResultSchema>;
export type ProjectFileSearchResult = z.infer<typeof fileSearchResultSchema>;
export type EntitySearchResult = z.infer<typeof entitySearchResultSchema>;
export type SchemaSearchResult = z.infer<typeof schemaSearchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
