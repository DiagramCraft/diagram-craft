import { oc, eventIterator } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId, foreignKeySchema } from '@arch-register/api-types/common';
import {
  documentFieldSchema,
  documentAiActionSchema,
  documentValueSchema,
  documentGeneratedMetadataSchema,
  documentMetadataSchema,
  documentTypeSchema
} from '@arch-register/api-types/documentContract';
import { conditionsQuerySchema } from '@arch-register/api-types/viewContract';

// ── Shared sub-schemas ────────────────────────────────────────

const projectCapabilitiesSchema = z.object({
  canEdit: z.boolean().describe('Whether the user can edit this project'),
  canDelete: z.boolean().describe('Whether the user can delete this project'),
  canManageFiles: z.boolean().describe('Whether the user can manage files in this project')
});

const projectSchema = projectCapabilitiesSchema.extend({
  id: z.string().describe('Unique project identifier'),
  public_id: z.string().describe('Public project identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Project name'),
  description: z.string().describe('Project description'),
  owner: foreignKeySchema.nullable().describe('Project owner'),
  status: z.enum(['draft', 'active', 'complete', 'cancelled']).describe('Project status'),
  color: z.string().nullable().describe('Project color (hex format)'),
  target_date: z.string().nullable().describe('Target completion date (ISO 8601)'),
  pinned: z.boolean().describe('Whether the project is pinned'),
  file_count: z.number().describe('Number of files in the project'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const projectEntitySchema = z.object({
  entity_id: z.string().describe('Entity identifier'),
  entity_name: z.string().describe('Entity name'),
  entity_slug: z.string().describe('Entity URL slug'),
  entity_description: z.string().describe('Entity description'),
  entity_schema: foreignKeySchema.nullable().describe('Entity schema reference'),
  entity_type: foreignKeySchema.nullable().describe('Project entity type classification'),
  is_done: z.boolean().describe('Whether the entity is marked as done')
});

const entityProjectSchema = z.object({
  project: projectSchema.describe('Linked project'),
  entity_type: foreignKeySchema.nullable().describe('Project entity type classification')
});

export const contentMetadataSchema = z.object({
  title: z.string().nullable().describe('Content title'),
  description: z.string().nullable().describe('Content description'),
  company: z.string().nullable().describe('Company name'),
  category: z.string().nullable().describe('Content category'),
  keywords: z.array(z.string()).describe('Content keywords')
});

export const projectFileSchema = z.object({
  id: z.string().describe('Unique file identifier'),
  project_id: z
    .string()
    .nullable()
    .describe('Parent project identifier (null for entity/workspace files)'),
  entity_id: z
    .string()
    .nullable()
    .optional()
    .describe('Parent entity identifier (null for project/workspace files)'),
  project_public_id: z.string().nullable().optional().describe('Public project identifier'),
  path: z.string().describe('File path within the project/entity/workspace'),
  name: z.string().describe('File name'),
  role: z.enum(['attachment-container']).nullable().optional().describe('Special file role'),
  size_bytes: z.number().describe('File size in bytes'),
  comment_count: z.number().optional().describe('Number of comments on the file'),
  unresolved_comment_count: z.number().optional().describe('Number of unresolved comments'),
  is_template: z.boolean().optional().describe('Whether the file is a project template'),
  is_workspace_template: z
    .boolean()
    .optional()
    .describe('Whether the file is a workspace-level template'),
  preview_svg: z.string().nullable().optional().describe('SVG preview of the file (for diagrams)'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp'),
  type: z.enum(['diagram', 'folder', 'markdown', 'file']).describe('File type'),
  created_by: z.string().nullable().optional().describe('User who created the file'),
  updated_by: z.string().nullable().optional().describe('User who last updated the file'),
  mime_type: z.string().nullable().optional().describe('MIME type for generic files'),
  original_filename: z
    .string()
    .nullable()
    .optional()
    .describe('Original filename for uploaded files'),
  document_type_icon: z
    .string()
    .nullable()
    .optional()
    .describe('Assigned document type icon for markdown files'),
  read_only: z
    .boolean()
    .optional()
    .describe('Whether this content is managed by an external mount'),
  mount_id: z.string().nullable().optional().describe('External content mount identifier'),
  content_metadata: contentMetadataSchema.nullable().describe('Content metadata (for diagrams)')
});

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

const markdownContentSchema = z.object({
  body: z.string().describe('Markdown content'),
  attachments: z.array(projectFileSchema).describe('Attached files (diagrams, etc.)'),
  document_type: documentTypeSchema.nullable().describe('Assigned typed document definition'),
  document_type_id: z.string().nullable().describe('Assigned document type identifier'),
  metadata: documentMetadataSchema.describe('Structured document metadata'),
  generated_metadata: documentGeneratedMetadataSchema.describe(
    'AI-generated metadata details keyed by output field identifier'
  ),
  available_fields: z.array(documentFieldSchema).describe('Current fields available for editing'),
  retired_fields: z.array(documentFieldSchema).describe('Retired fields retained for history')
});

const fileFolderSchema = z.object({
  path: z.string().describe('Folder path'),
  name: z.string().describe('Folder name'),
  files: z.array(projectFileSchema).describe('Files in this folder'),
  read_only: z.boolean().optional().describe('Whether this folder is managed by an external mount'),
  mount_id: z.string().nullable().optional().describe('External content mount identifier')
});

const fileTreeSchema = z.object({
  folders: z.array(fileFolderSchema).describe('Folder structure'),
  rootFiles: z.array(projectFileSchema).describe('Files in the root directory')
});

const projectDetailSchema = projectSchema.extend({
  files: fileTreeSchema.describe('Project file tree')
});

const diagramEntityFileSchema = z.object({
  file: projectFileSchema.describe('Diagram file'),
  project: z
    .object({
      id: z.string().describe('Project identifier'),
      public_id: z.string().describe('Public project identifier'),
      name: z.string().describe('Project name')
    })
    .describe('Parent project information')
});

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
  metadata: documentMetadataSchema
});

const runAiActionResponseSchema = z.object({
  actionId: z.string().describe('Identifier of the AI action that was run'),
  actionName: z.string().describe('Display name of the AI action'),
  prompt: z.string().describe('Predefined prompt of the AI action'),
  answer: z.string().describe('The AI-generated answer'),
  documentTitle: z.string().describe('Title of the document the action was run against'),
  nodeId: z.string().describe('Markdown node identifier the action was run against')
});

const runAiActionEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), delta: z.string().describe('Incremental answer text') }),
  runAiActionResponseSchema.extend({
    type: z.literal('done').describe('Signals the run is complete with the full answer')
  })
]);

const aiActionTestToolCallSchema = z.object({
  name: z.string().describe('Read-only tool name'),
  status: z.enum(['completed', 'failed']).describe('Tool execution status'),
  error: z.string().nullable().describe('Actionable tool error, if any')
});

const aiActionTestResultSchema = z.object({
  type: z.literal('done'),
  actionId: z.string(),
  actionName: z.string(),
  kind: z.enum(['interactive', 'metadata_generator']),
  prompt: z.string(),
  documentTitle: z.string(),
  nodeId: z.string(),
  provider: z.string(),
  model: z.string(),
  durationMs: z.number().int().nonnegative(),
  rawOutput: z.string(),
  parsedValue: documentValueSchema.nullable(),
  outputFieldId: z.string().nullable(),
  status: z.enum(['success', 'invalid_output', 'failed']),
  errors: z.array(z.string()),
  toolCalls: z.array(aiActionTestToolCallSchema)
});

const aiActionTestEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), delta: z.string() }),
  aiActionTestResultSchema
]);

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

// ── Request schemas ───────────────────────────────────────────

const deleteProjectResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

const createFolderResponseSchema = z.object({
  success: z.boolean().describe('Whether the folder was created'),
  path: z.string().describe('Created folder path'),
  marker: projectFileSchema.nullable().describe('Folder marker file (if created)')
});

const renameFolderResponseSchema = z.object({
  success: z.boolean().describe('Whether the rename was successful'),
  message: z.string().describe('Status message'),
  count: z.number().describe('Number of files affected')
});

const deleteFileResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful')
});

const deleteFolderResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  count: z.number().describe('Number of files deleted')
});

// ── Contract ──────────────────────────────────────────────────

export const projectContract = oc.tag('Projects').router({
  projects: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects',
        inputStructure: 'detailed',
        summary: 'List projects',
        description: 'Retrieves all projects in the workspace with their metadata and file counts.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws
        })
      )
      .output(z.array(projectSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}',
        inputStructure: 'detailed',
        summary: 'Get project details',
        description: 'Retrieves complete project details including the file tree structure.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(projectDetailSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects',
        inputStructure: 'detailed',
        summary: 'Create project',
        description: 'Creates a new project with the specified metadata.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            name: z.string().describe('Project name'),
            description: z.preprocess(
              v => (v === undefined ? undefined : typeof v === 'string' ? v : ''),
              z.string().optional().describe('Project description')
            ),
            owner: z.string().nullable().optional().describe('Project owner identifier'),
            status: z
              .enum(['draft', 'active', 'complete', 'cancelled'])
              .optional()
              .describe('Project status'),
            color: z.preprocess(
              v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
              z.string().nullable().optional().describe('Project color (hex format)')
            ),
            target_date: z
              .string()
              .nullable()
              .optional()
              .describe('Target completion date (ISO 8601)'),
            pinned: z.boolean().optional().describe('Whether to pin the project')
          })
        })
      )
      .output(projectSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}',
        inputStructure: 'detailed',
        summary: 'Update project',
        description: 'Updates project metadata. Only provided fields will be updated.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            name: z.string().describe('Project name'),
            description: z.string().optional().describe('Project description'),
            owner: z.string().nullable().optional().describe('Project owner identifier'),
            status: z
              .enum(['draft', 'active', 'complete', 'cancelled'])
              .optional()
              .describe('Project status'),
            color: z.string().nullable().optional().describe('Project color (hex format)'),
            target_date: z
              .string()
              .nullable()
              .optional()
              .describe('Target completion date (ISO 8601)'),
            pinned: z.boolean().optional().describe('Whether the project is pinned')
          })
        })
      )
      .output(projectSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}',
        inputStructure: 'detailed',
        summary: 'Delete project',
        description:
          'Permanently deletes a project and all its files. This operation cannot be undone.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(deleteProjectResponseSchema),
    listFiles: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/files',
        inputStructure: 'detailed',
        summary: 'List project files',
        description:
          'Retrieves the file tree structure for a project, including folders and files.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(fileTreeSchema),
    createFolder: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/folders',
        inputStructure: 'detailed',
        summary: 'Create project folder',
        description: 'Creates a new folder in the project at the specified path.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            path: z.string().describe('Folder path to create')
          })
        })
      )
      .output(createFolderResponseSchema),
    renameFolder: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/folders/rename',
        inputStructure: 'detailed',
        summary: 'Rename project folder',
        description: 'Renames a folder and updates all file paths within it.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            oldPath: z.string().describe('Current folder path'),
            newPath: z.string().describe('New folder path')
          })
        })
      )
      .output(renameFolderResponseSchema),
    deleteFolder: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}/folders',
        inputStructure: 'detailed',
        summary: 'Delete project folder',
        description: 'Deletes a folder and all its contents. This operation cannot be undone.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string().describe('Folder path to delete') })
        })
      )
      .output(deleteFolderResponseSchema),
    getFileContent: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/files/content',
        inputStructure: 'detailed',
        summary: 'Get project file content',
        description: 'Retrieves the content of a diagram file in the project.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string().describe('File path') })
        })
      )
      .output(z.record(z.string(), z.unknown())),
    saveFile: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/files',
        inputStructure: 'detailed',
        summary: 'Save project file',
        description: 'Saves or updates a diagram file in the project.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string().describe('File path') }),
          body: z.record(z.string(), z.unknown()).describe('File content')
        })
      )
      .output(projectFileSchema),
    deleteFile: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}/files',
        inputStructure: 'detailed',
        summary: 'Delete project file',
        description:
          'Permanently deletes a file from the project. This operation cannot be undone.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string().describe('File path to delete') })
        })
      )
      .output(deleteFileResponseSchema),
    cloneFile: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/files/clone',
        inputStructure: 'detailed',
        summary: 'Clone project file',
        description: 'Creates a copy of a file in the same project with a new name.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string().describe('File path to clone') })
        })
      )
      .output(projectFileSchema),
    relocateFile: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/files/relocate',
        inputStructure: 'detailed',
        summary: 'Move project file',
        description: 'Moves or renames a file within the project.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string().describe('Current file path') }),
          body: z.object({
            newPath: z.string().describe('New file path')
          })
        })
      )
      .output(projectFileSchema),
    updateTemplateStatus: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/template-status',
        inputStructure: 'detailed',
        summary: 'Update file template status',
        description: 'Marks a file as a template or removes its template status.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string().describe('File path') }),
          body: z.object({
            is_template: z.boolean().describe('Whether the file is a project template'),
            is_workspace_template: z
              .boolean()
              .describe('Whether the file is a workspace-level template')
          })
        })
      )
      .output(projectFileSchema),
    listEntities: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/entities',
        inputStructure: 'detailed',
        summary: 'List project entities',
        description: 'Retrieves all entities linked to the project.',
        tags: ['Projects']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(projectEntitySchema)),
    listEntityProjects: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/projects',
        inputStructure: 'detailed',
        summary: 'List projects containing an entity',
        description: 'Retrieves accessible projects linked to an entity in a single request.',
        tags: ['Projects']
      })
      .input(
        z.object({ params: ws.extend({ entityId: z.string().describe('Entity identifier') }) })
      )
      .output(z.array(entityProjectSchema)),
    addEntity: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/entities',
        inputStructure: 'detailed',
        summary: 'Link entity to project',
        description:
          'Links an entity to the project with optional type classification and completion status.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            entity_id: z.string().describe('Entity identifier to link'),
            entity_type: z
              .string()
              .nullable()
              .optional()
              .describe('Project entity type classification'),
            is_done: z.boolean().optional().describe('Whether the entity is marked as done')
          })
        })
      )
      .output(projectEntitySchema),
    updateEntity: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/entities/{entityId}',
        inputStructure: 'detailed',
        summary: 'Update project entity',
        description: 'Updates the type classification or completion status of a linked entity.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: wsAndId.extend({ entityId: z.string().describe('Entity identifier') }),
          body: z.object({
            entity_type: z
              .string()
              .nullable()
              .optional()
              .describe('Project entity type classification'),
            is_done: z.boolean().optional().describe('Whether the entity is marked as done')
          })
        })
      )
      .output(projectEntitySchema),
    removeEntity: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}/entities/{entityId}',
        inputStructure: 'detailed',
        summary: 'Unlink entity from project',
        description:
          'Removes the link between an entity and the project. The entity itself is not deleted.',
        tags: ['Projects']
      })
      .input(
        z.object({ params: wsAndId.extend({ entityId: z.string().describe('Entity identifier') }) })
      )
      .output(z.object({ success: z.boolean().describe('Whether the unlink was successful') })),
    getEntityDiagramFiles: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/diagram-files',
        inputStructure: 'detailed',
        summary: 'Get entity diagram files',
        description: 'Retrieves all diagram files associated with an entity across all projects.',
        tags: ['Projects']
      })
      .input(
        z.object({ params: ws.extend({ entityId: z.string().describe('Entity identifier') }) })
      )
      .output(z.array(diagramEntityFileSchema)),
    listEntityFiles: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/content',
        inputStructure: 'detailed',
        summary: 'List entity files',
        description: 'Retrieves the file tree structure for entity-scoped content.',
        tags: ['Projects']
      })
      .input(
        z.object({ params: ws.extend({ entityId: z.string().describe('Entity identifier') }) })
      )
      .output(fileTreeSchema),
    createEntityFolder: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/content/folders',
        inputStructure: 'detailed',
        summary: 'Create entity folder',
        description: 'Creates a new folder in the entity content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({ entityId: z.string().describe('Entity identifier') }),
          body: z.object({ path: z.string().describe('Folder path to create') })
        })
      )
      .output(createFolderResponseSchema),
    createEntityFile: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/content/files',
        inputStructure: 'detailed',
        summary: 'Create entity file',
        description: 'Creates a new diagram file in the entity content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({ entityId: z.string().describe('Entity identifier') }),
          query: z.object({ path: z.string().describe('File path') }),
          body: z.record(z.string(), z.unknown()).describe('File content')
        })
      )
      .output(projectFileSchema),
    listWorkspaceFiles: oc
      .route({
        method: 'GET',
        path: '/{workspace}/content',
        inputStructure: 'detailed',
        summary: 'List workspace files',
        description: 'Retrieves the file tree structure for workspace-scoped content.',
        tags: ['Projects']
      })
      .input(z.object({ params: ws }))
      .output(fileTreeSchema),
    deleteEntityFile: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/entities/{entityId}/content/files',
        inputStructure: 'detailed',
        summary: 'Delete entity file',
        description: 'Permanently deletes a file from the entity content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({ entityId: z.string().describe('Entity identifier') }),
          query: z.object({ path: z.string().describe('File path to delete') })
        })
      )
      .output(deleteFileResponseSchema),
    deleteEntityFolder: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/entities/{entityId}/content/folders',
        inputStructure: 'detailed',
        summary: 'Delete entity folder',
        description: 'Deletes a folder and all its contents from the entity content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({ entityId: z.string().describe('Entity identifier') }),
          query: z.object({ path: z.string().describe('Folder path to delete') })
        })
      )
      .output(deleteFolderResponseSchema),
    renameEntityFolder: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/entities/{entityId}/content/folders/rename',
        inputStructure: 'detailed',
        summary: 'Rename entity folder',
        description:
          'Renames a folder in the entity content area and updates all file paths within it.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({ entityId: z.string().describe('Entity identifier') }),
          body: z.object({
            oldPath: z.string().describe('Current folder path'),
            newPath: z.string().describe('New folder path')
          })
        })
      )
      .output(renameFolderResponseSchema),
    cloneEntityFile: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/content/files/clone',
        inputStructure: 'detailed',
        summary: 'Clone entity file',
        description: 'Creates a copy of a file in the entity content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({ entityId: z.string().describe('Entity identifier') }),
          query: z.object({ path: z.string().describe('File path to clone') })
        })
      )
      .output(projectFileSchema),
    relocateEntityFile: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/entities/{entityId}/content/files/relocate',
        inputStructure: 'detailed',
        summary: 'Move entity file',
        description: 'Moves or renames a file within the entity content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({ entityId: z.string().describe('Entity identifier') }),
          query: z.object({ path: z.string().describe('Current file path') }),
          body: z.object({ newPath: z.string().describe('New file path') })
        })
      )
      .output(projectFileSchema),
    deleteWorkspaceFile: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/content/files',
        inputStructure: 'detailed',
        summary: 'Delete workspace file',
        description: 'Permanently deletes a file from the workspace content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ path: z.string().describe('File path to delete') })
        })
      )
      .output(deleteFileResponseSchema),
    deleteWorkspaceFolder: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/content/folders',
        inputStructure: 'detailed',
        summary: 'Delete workspace folder',
        description: 'Deletes a folder and all its contents from the workspace content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ path: z.string().describe('Folder path to delete') })
        })
      )
      .output(deleteFolderResponseSchema),
    renameWorkspaceFolder: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/content/folders/rename',
        inputStructure: 'detailed',
        summary: 'Rename workspace folder',
        description:
          'Renames a folder in the workspace content area and updates all file paths within it.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            oldPath: z.string().describe('Current folder path'),
            newPath: z.string().describe('New folder path')
          })
        })
      )
      .output(renameFolderResponseSchema),
    cloneWorkspaceFile: oc
      .route({
        method: 'POST',
        path: '/{workspace}/content/files/clone',
        inputStructure: 'detailed',
        summary: 'Clone workspace file',
        description: 'Creates a copy of a file in the workspace content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ path: z.string().describe('File path to clone') })
        })
      )
      .output(projectFileSchema),
    relocateWorkspaceFile: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/content/files/relocate',
        inputStructure: 'detailed',
        summary: 'Move workspace file',
        description: 'Moves or renames a file within the workspace content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ path: z.string().describe('Current file path') }),
          body: z.object({ newPath: z.string().describe('New file path') })
        })
      )
      .output(projectFileSchema),
    createWorkspaceFolder: oc
      .route({
        method: 'POST',
        path: '/{workspace}/content/folders',
        inputStructure: 'detailed',
        summary: 'Create workspace folder',
        description: 'Creates a new folder in the workspace content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({ path: z.string().describe('Folder path to create') })
        })
      )
      .output(createFolderResponseSchema),
    createWorkspaceFile: oc
      .route({
        method: 'POST',
        path: '/{workspace}/content/files',
        inputStructure: 'detailed',
        summary: 'Create workspace file',
        description: 'Creates a new diagram file in the workspace content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ path: z.string().describe('File path') }),
          body: z.record(z.string(), z.unknown()).describe('File content')
        })
      )
      .output(projectFileSchema),
    getWorkspaceFileContent: oc
      .route({
        method: 'GET',
        path: '/{workspace}/content/files/content',
        inputStructure: 'detailed',
        summary: 'Get workspace file content',
        description: 'Retrieves the content of a diagram file in the workspace content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ path: z.string().describe('File path') })
        })
      )
      .output(z.record(z.string(), z.unknown())),
    saveWorkspaceFile: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/content/files',
        inputStructure: 'detailed',
        summary: 'Save workspace file',
        description: 'Saves or updates a diagram file in the workspace content area.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ path: z.string().describe('File path') }),
          body: z.record(z.string(), z.unknown()).describe('File content')
        })
      )
      .output(projectFileSchema),
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
            metadata: documentMetadataSchema.optional().describe('Structured metadata values')
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
            metadata: documentMetadataSchema.describe('Reviewed structured metadata values')
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
          })
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
      .output(projectFileSchema),
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
      .output(z.array(documentBacklinkSchema)),
    runDocumentAiAction: oc
      .route({
        method: 'POST',
        path: '/{workspace}/documents/{nodeId}/ai-actions/{actionId}/run',
        inputStructure: 'detailed',
        summary: 'Run an interactive AI action for a document',
        description:
          'Runs a document type-defined interactive AI action against the current document body, metadata, document type, and location context, using read-only tools, and streams the answer as it is generated. Does not modify the document, its metadata, or any entities.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({
            nodeId: z.string().describe('Markdown node identifier'),
            actionId: z.string().describe('AI action identifier')
          })
        })
      )
      .output(eventIterator(runAiActionEventSchema)),
    testDocumentAiAction: oc
      .route({
        method: 'POST',
        path: '/{workspace}/documents/{nodeId}/ai-actions/test',
        inputStructure: 'detailed',
        summary: 'Test a document type AI action',
        description:
          'Tests a draft document type AI action against an existing document using read-only tools and permissions without persisting any document, metadata, revision, or schedule changes.',
        tags: ['Projects']
      })
      .input(
        z.object({
          params: ws.extend({ nodeId: z.string().describe('Markdown document identifier') }),
          body: z.object({
            documentTypeId: z.string().describe('Document type being edited'),
            action: documentAiActionSchema.describe('Unsaved AI action draft')
          })
        })
      )
      .output(eventIterator(aiActionTestEventSchema)),
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
  }
});

export type Project = z.infer<typeof projectSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;
export type ContentMetadata = z.infer<typeof contentMetadataSchema>;
export type MarkdownContent = z.infer<typeof markdownContentSchema>;
export type RunAiActionResponse = z.infer<typeof runAiActionResponseSchema>;
export type RunAiActionEvent = z.infer<typeof runAiActionEventSchema>;
export type AiActionTestResult = z.infer<typeof aiActionTestResultSchema>;
export type AiActionTestEvent = z.infer<typeof aiActionTestEventSchema>;
export type MarkdownRevisionSummary = z.infer<typeof markdownRevisionSummarySchema>;
export type MarkdownRevisionDetail = z.infer<typeof markdownRevisionDetailSchema>;
export type FileTree = z.infer<typeof fileTreeSchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type ProjectEntity = z.infer<typeof projectEntitySchema>;
export type EntityProject = z.infer<typeof entityProjectSchema>;
export type DiagramEntityFile = z.infer<typeof diagramEntityFileSchema>;
export type DocumentListItem = z.infer<typeof documentListItemSchema>;
export type RelatedDocument = z.infer<typeof relatedDocumentSchema>;
export type DocumentBacklink = z.infer<typeof documentBacklinkSchema>;
