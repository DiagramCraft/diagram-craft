import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId } from '@arch-register/api-types/common';

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

const fileFolderSchema = z.object({
  path: z.string().describe('Folder path'),
  name: z.string().describe('Folder name'),
  files: z.array(projectFileSchema).describe('Files in this folder'),
  read_only: z.boolean().optional().describe('Whether this folder is managed by an external mount'),
  mount_id: z.string().nullable().optional().describe('External content mount identifier')
});

export const fileTreeSchema = z.object({
  folders: z.array(fileFolderSchema).describe('Folder structure'),
  rootFiles: z.array(projectFileSchema).describe('Files in the root directory')
});

export const createFolderResponseSchema = z.object({
  success: z.boolean().describe('Whether the folder was created'),
  path: z.string().describe('Created folder path'),
  marker: projectFileSchema.nullable().describe('Folder marker file (if created)')
});

export const renameFolderResponseSchema = z.object({
  success: z.boolean().describe('Whether the rename was successful'),
  message: z.string().describe('Status message'),
  count: z.number().describe('Number of files affected')
});

export const deleteFileResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful')
});

export const deleteFolderResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  count: z.number().describe('Number of files deleted')
});

const projectContentProjectContract = {
  listFiles: oc
    .route({
      method: 'GET',
      path: '/{workspace}/projects/{id}/files',
      inputStructure: 'detailed',
      summary: 'List project files',
      description: 'Retrieves the file tree structure for a project, including folders and files.',
      tags: ['Projects']
    })
    .input(z.object({ params: wsAndId }))
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
      description: 'Permanently deletes a file from the project. This operation cannot be undone.',
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
        body: z.object({ newPath: z.string().describe('New file path') })
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
    .output(projectFileSchema)
};

const projectContentScopedContract = {
  listEntityFiles: oc
    .route({
      method: 'GET',
      path: '/{workspace}/entities/{entityId}/content',
      inputStructure: 'detailed',
      summary: 'List entity files',
      description: 'Retrieves the file tree structure for entity-scoped content.',
      tags: ['Projects']
    })
    .input(z.object({ params: ws.extend({ entityId: z.string().describe('Entity identifier') }) }))
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
    .output(projectFileSchema)
};

export const projectContentContract = {
  ...projectContentProjectContract,
  ...projectContentScopedContract
};

export { projectContentProjectContract, projectContentScopedContract };

export type ContentMetadata = z.infer<typeof contentMetadataSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;
export type FileTree = z.infer<typeof fileTreeSchema>;
