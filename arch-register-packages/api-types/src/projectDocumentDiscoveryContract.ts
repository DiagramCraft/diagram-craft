import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import {
  documentMetadataSchema,
  documentWorkflowStatusSchema
} from '@arch-register/api-types/documentContract';
import { conditionsQuerySchema } from '@arch-register/api-types/viewContract';
import { projectFileSchema } from './projectContentContract';

const relatedDocumentSchema = z.object({
  file: projectFileSchema,
  scope: z.enum(['project', 'entity', 'workspace']),
  document_type_id: z.string().nullable(),
  document_type_name: z.string().nullable(),
  document_type_color: z.string().nullable(),
  document_type_icon: z.string().nullable(),
  field_id: z.string(),
  field_name: z.string(),
  field_inverse_name: z.string().nullable()
});

const documentBacklinkSchema = relatedDocumentSchema;

const documentListItemSchema = z.object({
  file: projectFileSchema,
  scope: z.enum(['workspace', 'project', 'entity']),
  document_type_id: z.string().nullable(),
  document_type_name: z.string().nullable(),
  document_type_color: z.string().nullable(),
  document_type_icon: z.string().nullable(),
  metadata: documentMetadataSchema,
  workflow: z.array(documentWorkflowStatusSchema).optional()
});

const documentListQuerySchema = z.object({
  q: z.string().optional().describe('Search query string, matched against document title'),
  scope: z.enum(['workspace', 'project', 'entity']).optional().describe('Filter by scope'),
  project_id: z.string().optional().describe('Filter to documents within this project'),
  entity_id: z.string().optional().describe('Filter to documents within this entity'),
  document_type_id: z
    .string()
    .optional()
    .describe("Filter by document type identifier, or 'none' for untyped documents"),
  conditions: conditionsQuerySchema.describe('Additional filter conditions on metadata fields'),
  sort: z
    .string()
    .optional()
    .describe("Sort field: 'title', 'updated_at', or a metadata field identifier"),
  sort_dir: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  limit: z
    .preprocess(
      value => (value === undefined ? undefined : Number(value)),
      z.number().int().positive().max(100).optional()
    )
    .describe('Maximum number of results (default and max 100)')
});

export const projectDocumentDiscoveryRelatedContract = {
  listRelatedContent: oc
    .route({
      method: 'GET',
      path: '/{workspace}/entities/{entityId}/related-content',
      inputStructure: 'detailed',
      summary: 'List related typed documents',
      description: 'Lists accessible markdown documents that link to an entity in metadata.',
      tags: ['Projects']
    })
    .input(z.object({ params: ws.extend({ entityId: z.string() }) }))
    .output(z.array(relatedDocumentSchema)),
  listDocumentBacklinks: oc
    .route({
      method: 'GET',
      path: '/{workspace}/documents/{nodeId}/backlinks',
      inputStructure: 'detailed',
      summary: 'List document backlinks',
      description:
        'Lists accessible markdown documents whose metadata links to this document, via entity_link or document_link fields.',
      tags: ['Projects']
    })
    .input(z.object({ params: ws.extend({ nodeId: z.string() }) }))
    .output(z.array(documentBacklinkSchema))
};

export const projectDocumentDiscoveryListContract = {
  listDocuments: oc
    .route({
      method: 'GET',
      path: '/{workspace}/documents',
      inputStructure: 'detailed',
      summary: 'List Markdown documents across scopes',
      description:
        'Lists accessible Markdown documents (typed and untyped) across workspace, project, and entity scopes, with filtering.',
      tags: ['Projects']
    })
    .input(z.object({ params: ws, query: documentListQuerySchema }))
    .output(z.array(documentListItemSchema))
};

export const projectDocumentDiscoveryContract = {
  ...projectDocumentDiscoveryRelatedContract,
  ...projectDocumentDiscoveryListContract
};

export type RelatedDocument = z.infer<typeof relatedDocumentSchema>;
export type DocumentBacklink = z.infer<typeof documentBacklinkSchema>;
export type DocumentListItem = z.infer<typeof documentListItemSchema>;
