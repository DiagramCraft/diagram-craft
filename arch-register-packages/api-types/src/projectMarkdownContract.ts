import { oc } from '@orpc/contract';
import { z } from 'zod';
import { externalUpdateEnvelopeSchema, ws, wsAndId } from '@arch-register/api-types/common';
import {
  documentFieldSchema,
  documentGeneratedMetadataSchema,
  documentMetadataSchema,
  documentTypeSchema,
  documentWorkflowHistoryEventSchema,
  documentWorkflowStatusSchema
} from '@arch-register/api-types/documentContract';
import { projectFileSchema } from './projectContentContract';

const markdownRevisionSummarySchema = z.object({
  id: z.string().describe('Revision identifier'),
  revision_number: z.number().int().positive().describe('Sequential revision number'),
  title: z.string().nullable().describe('Revision title'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  created_by: z.string().nullable().describe('User who created the revision'),
  created_by_name: z.string().nullable().describe('Display name of creator'),
  restored_from_revision_id: z.string().nullable().describe('Source revision if this is a restore'),
  document_type_id: z.string().nullable().describe('Document type assigned to this revision'),
  metadata: documentMetadataSchema.describe('Structured document metadata at this revision')
});

const markdownRevisionDetailSchema = markdownRevisionSummarySchema.extend({
  body: z.string().describe('Markdown content')
});

export const markdownContentSchema = z.object({
  body: z.string().describe('Markdown content'),
  attachments: z.array(projectFileSchema).describe('Attached files (diagrams, etc.)'),
  document_type: documentTypeSchema.nullable().describe('Assigned typed document definition'),
  document_type_id: z.string().nullable().describe('Assigned document type identifier'),
  metadata: documentMetadataSchema.describe('Structured document metadata'),
  generated_metadata: documentGeneratedMetadataSchema.describe(
    'AI-generated metadata details keyed by output field identifier'
  ),
  available_fields: z.array(documentFieldSchema).describe('Current fields available for editing'),
  retired_fields: z.array(documentFieldSchema).describe('Retired fields retained for history'),
  workflow: z.array(documentWorkflowStatusSchema).optional()
});

export const projectMarkdownContract = {
  createProjectMarkdown: oc
    .route({
      method: 'POST',
      path: '/{workspace}/projects/{id}/markdown',
      inputStructure: 'detailed',
      summary: 'Create project markdown',
      description: 'Creates a new markdown document in the project.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: wsAndId,
        body: z.object({
          name: z.string().describe('Markdown document name'),
          folder: z.string().optional().describe('Optional folder path')
        })
      })
    )
    .output(projectFileSchema),
  createEntityMarkdown: oc
    .route({
      method: 'POST',
      path: '/{workspace}/entities/{entityId}/markdown',
      inputStructure: 'detailed',
      summary: 'Create entity markdown',
      description: 'Creates a new markdown document in the entity content area.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ entityId: z.string().describe('Entity identifier') }),
        body: z.object({
          name: z.string().describe('Markdown document name'),
          folder: z.string().optional().describe('Optional folder path')
        })
      })
    )
    .output(projectFileSchema),
  createWorkspaceMarkdown: oc
    .route({
      method: 'POST',
      path: '/{workspace}/content/markdown',
      inputStructure: 'detailed',
      summary: 'Create workspace markdown',
      description: 'Creates a new markdown document in the workspace content area.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws,
        body: z.object({
          name: z.string().describe('Markdown document name'),
          folder: z.string().optional().describe('Optional folder path')
        })
      })
    )
    .output(projectFileSchema),
  getFile: oc
    .route({
      method: 'GET',
      path: '/{workspace}/files/{fileId}',
      inputStructure: 'detailed',
      summary: 'Get file metadata',
      description: 'Retrieves metadata for a specific file by its identifier.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ fileId: z.string().describe('File identifier') })
      })
    )
    .output(projectFileSchema),
  getDiagramContent: oc
    .route({
      method: 'GET',
      path: '/{workspace}/files/{fileId}/content',
      inputStructure: 'detailed',
      summary: 'Get diagram content by ID',
      description: 'Retrieves the content of a diagram file by its identifier.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ fileId: z.string().describe('File identifier') })
      })
    )
    .output(z.record(z.string(), z.unknown())),
  getMarkdownContent: oc
    .route({
      method: 'GET',
      path: '/{workspace}/markdown/{nodeId}',
      inputStructure: 'detailed',
      summary: 'Get markdown content',
      description: 'Retrieves the content of a markdown document including its attachments.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ nodeId: z.string().describe('Markdown node identifier') })
      })
    )
    .output(markdownContentSchema),
  saveMarkdownContent: oc
    .route({
      method: 'PUT',
      path: '/{workspace}/markdown/{nodeId}',
      inputStructure: 'detailed',
      summary: 'Save markdown content',
      description: 'Saves or updates the content of a markdown document.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ nodeId: z.string().describe('Markdown node identifier') }),
        body: z.object({
          body: z.string().describe('Markdown content'),
          name: z.string().optional().describe('Optional new name for the document'),
          document_type_id: z.string().nullable().optional().describe('Document type identifier'),
          metadata: documentMetadataSchema.optional().describe('Structured metadata values'),
          change_kind: z.enum(['minor', 'major']).default('minor'),
          initiation_fields: z.record(z.string(), z.unknown()).optional(),
          external: externalUpdateEnvelopeSchema
            .optional()
            .describe(
              'Present when this save is an external update (AI/integration/automation) ' +
                'rather than a user edit; required to write to any field with external_kind set'
            )
        })
      })
    )
    .output(projectFileSchema),
  migrateMarkdownContent: oc
    .route({
      method: 'POST',
      path: '/{workspace}/markdown/{nodeId}/migrate',
      inputStructure: 'detailed',
      summary: 'Migrate markdown document type',
      description:
        'Explicitly changes or removes the document type of a markdown document and saves the reviewed metadata.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ nodeId: z.string().describe('Markdown node identifier') }),
        body: z.object({
          body: z.string().describe('Markdown content'),
          name: z.string().optional().describe('Optional new name for the document'),
          document_type_id: z
            .string()
            .nullable()
            .describe('New document type identifier, or null to remove the type'),
          metadata: documentMetadataSchema.describe('Reviewed structured metadata values'),
          change_kind: z.enum(['minor', 'major']).default('major'),
          initiation_fields: z.record(z.string(), z.unknown()).optional()
        })
      })
    )
    .output(projectFileSchema),
  saveNewMarkdownContent: oc
    .route({
      method: 'POST',
      path: '/{workspace}/markdown',
      inputStructure: 'detailed',
      summary: 'Save a new markdown document',
      description: 'Atomically creates a markdown node, body, metadata, and first revision.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws,
        body: z.object({
          scope: z.enum(['project', 'entity', 'workspace']),
          project_id: z.string().optional(),
          entity_id: z.string().optional(),
          name: z.string().min(1),
          folder: z.string().optional(),
          body: z.string(),
          document_type_id: z.string().nullable().optional(),
          metadata: documentMetadataSchema.default({})
        })
      })
    )
    .output(projectFileSchema),
  listMarkdownRevisions: oc
    .route({
      method: 'GET',
      path: '/{workspace}/markdown/{nodeId}/revisions',
      inputStructure: 'detailed',
      summary: 'List markdown revisions',
      description: 'Retrieves the revision history for a markdown document.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ nodeId: z.string().describe('Markdown node identifier') })
      })
    )
    .output(z.array(markdownRevisionSummarySchema)),
  listMarkdownWorkflowHistory: oc
    .route({
      method: 'GET',
      path: '/{workspace}/markdown/{nodeId}/workflow-history',
      inputStructure: 'detailed',
      summary: 'List document workflow history',
      tags: ['Projects']
    })
    .input(z.object({ params: ws.extend({ nodeId: z.string() }) }))
    .output(z.array(documentWorkflowHistoryEventSchema)),
  overrideMarkdownWorkflow: oc
    .route({
      method: 'POST',
      path: '/{workspace}/markdown/{nodeId}/workflow-override',
      inputStructure: 'detailed',
      summary: 'Override document workflow status',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ nodeId: z.string() }),
        body: z.object({
          field_id: z.string().min(1),
          target_value: z.string().min(1),
          reason: z.string().min(1)
        })
      })
    )
    .output(z.array(documentWorkflowStatusSchema)),
  getMarkdownRevision: oc
    .route({
      method: 'GET',
      path: '/{workspace}/markdown/{nodeId}/revisions/{revisionId}',
      inputStructure: 'detailed',
      summary: 'Get markdown revision',
      description: 'Retrieves a specific revision of a markdown document.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({
          nodeId: z.string().describe('Markdown node identifier'),
          revisionId: z.string().describe('Revision identifier')
        })
      })
    )
    .output(markdownRevisionDetailSchema),
  restoreMarkdownRevision: oc
    .route({
      method: 'POST',
      path: '/{workspace}/markdown/{nodeId}/revisions/{revisionId}/restore',
      inputStructure: 'detailed',
      summary: 'Restore markdown revision',
      description:
        'Restores a markdown document to a previous revision, creating a new revision in the process.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({
          nodeId: z.string().describe('Markdown node identifier'),
          revisionId: z.string().describe('Revision identifier to restore')
        }),
        body: z
          .object({
            change_kind: z.enum(['minor', 'major']).default('major'),
            initiation_fields: z.record(z.string(), z.unknown()).optional()
          })
          .optional()
      })
    )
    .output(projectFileSchema),
  createMarkdownDiagramAttachment: oc
    .route({
      method: 'POST',
      path: '/{workspace}/markdown/{nodeId}/attachments/diagram',
      inputStructure: 'detailed',
      summary: 'Create markdown diagram attachment',
      description: 'Creates a new diagram attachment for a markdown document.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ nodeId: z.string().describe('Markdown node identifier') }),
        body: z.object({
          name: z.string().describe('Diagram name'),
          content: z.record(z.string(), z.unknown()).describe('Diagram content')
        })
      })
    )
    .output(projectFileSchema)
};

export type MarkdownContent = z.infer<typeof markdownContentSchema>;
export type MarkdownRevisionSummary = z.infer<typeof markdownRevisionSummarySchema>;
export type MarkdownRevisionDetail = z.infer<typeof markdownRevisionDetailSchema>;
