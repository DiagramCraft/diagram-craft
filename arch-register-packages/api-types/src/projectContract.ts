import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId, foreignKeySchema } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

const projectCapabilitiesSchema = z.object({
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canManageFiles: z.boolean()
});

const projectSchema = projectCapabilitiesSchema.extend({
  id: z.string(),
  public_id: z.string(),
  workspace: z.string(),
  name: z.string(),
  description: z.string(),
  owner: foreignKeySchema.nullable(),
  status: z.enum(['draft', 'active', 'complete', 'cancelled']),
  color: z.string().nullable(),
  target_date: z.string().nullable(),
  pinned: z.boolean(),
  file_count: z.number(),
  created_at: z.string(),
  updated_at: z.string()
});

const projectEntitySchema = z.object({
  entity_id: z.string(),
  entity_name: z.string(),
  entity_slug: z.string(),
  entity_description: z.string(),
  entity_schema: foreignKeySchema.nullable(),
  entity_type: foreignKeySchema.nullable(),
  is_done: z.boolean()
});

export const projectFileSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  project_public_id: z.string().nullable().optional(),
  path: z.string(),
  name: z.string(),
  size_bytes: z.number(),
  comment_count: z.number().optional(),
  unresolved_comment_count: z.number().optional(),
  is_template: z.boolean().optional(),
  is_workspace_template: z.boolean().optional(),
  preview_svg: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  type: z.enum(['diagram', 'folder', 'markdown', 'file']),
  created_by: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional()
});

const fileFolderSchema = z.object({
  path: z.string(),
  name: z.string(),
  files: z.array(projectFileSchema)
});

const fileTreeSchema = z.object({
  folders: z.array(fileFolderSchema),
  rootFiles: z.array(projectFileSchema)
});

const projectDetailSchema = projectSchema.extend({
  files: fileTreeSchema
});

const diagramEntityFileSchema = z.object({
  file: projectFileSchema,
  project: z.object({ id: z.string(), public_id: z.string(), name: z.string() })
});

// ── Request schemas ───────────────────────────────────────────

const deleteProjectResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

const createFolderResponseSchema = z.object({
  success: z.boolean(),
  path: z.string(),
  marker: projectFileSchema.nullable()
});

const renameFolderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  count: z.number()
});

const deleteFileResponseSchema = z.object({
  success: z.boolean()
});

const deleteFolderResponseSchema = z.object({
  success: z.boolean(),
  count: z.number()
});

// ── Contract ──────────────────────────────────────────────────

export const projectContract = {
  projects: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/projects', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws
        })
      )
      .output(z.array(projectSchema)),
    get: oc
      .route({ method: 'GET', path: '/{workspace}/projects/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(projectDetailSchema),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/projects', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: z.object({
            name: z.string(),
            description: z.preprocess(
              v => (v === undefined ? undefined : typeof v === 'string' ? v : ''),
              z.string().optional()
            ),
            owner: z.string().nullable().optional(),
            status: z.enum(['draft', 'active', 'complete', 'cancelled']).optional(),
            color: z.preprocess(
              v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
              z.string().nullable().optional()
            ),
            target_date: z.string().nullable().optional(),
            pinned: z.boolean().optional()
          })
        })
      )
      .output(projectSchema),
    update: oc
      .route({ method: 'PUT', path: '/{workspace}/projects/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            name: z.string(),
            description: z.string().optional(),
            owner: z.string().nullable().optional(),
            status: z.enum(['draft', 'active', 'complete', 'cancelled']).optional(),
            color: z.string().nullable().optional(),
            target_date: z.string().nullable().optional(),
            pinned: z.boolean().optional()
          })
        })
      )
      .output(projectSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/projects/{id}', inputStructure: 'detailed' })
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
        inputStructure: 'detailed'
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
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            path: z.string()
          })
        })
      )
      .output(createFolderResponseSchema),
    renameFolder: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/folders/rename',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            oldPath: z.string(),
            newPath: z.string()
          })
        })
      )
      .output(renameFolderResponseSchema),
    deleteFolder: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}/folders',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string() })
        })
      )
      .output(deleteFolderResponseSchema),
    getFileContent: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/files/content',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string() })
        })
      )
      .output(z.record(z.string(), z.unknown())),
    saveFile: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/files',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string() }),
          body: z.record(z.string(), z.unknown())
        })
      )
      .output(projectFileSchema),
    deleteFile: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}/files',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string() })
        })
      )
      .output(deleteFileResponseSchema),
    cloneFile: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/files/clone',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string() })
        })
      )
      .output(projectFileSchema),
    relocateFile: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/files/relocate',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string() }),
          body: z.object({
            newPath: z.string()
          })
        })
      )
      .output(projectFileSchema),
    updateTemplateStatus: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/template-status',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          query: z.object({ path: z.string() }),
          body: z.object({
            is_template: z.boolean(),
            is_workspace_template: z.boolean()
          })
        })
      )
      .output(projectFileSchema),
    listEntities: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/entities',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(projectEntitySchema)),
    addEntity: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/entities',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId,
          body: z.object({
            entity_id: z.string(),
            entity_type: z.string().nullable().optional(),
            is_done: z.boolean().optional()
          })
        })
      )
      .output(projectEntitySchema),
    updateEntity: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/entities/{entityId}',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: wsAndId.extend({ entityId: z.string() }),
          body: z.object({
            entity_type: z.string().nullable().optional(),
            is_done: z.boolean().optional()
          })
        })
      )
      .output(projectEntitySchema),
    removeEntity: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}/entities/{entityId}',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: wsAndId.extend({ entityId: z.string() }) }))
      .output(z.object({ success: z.boolean() })),
    getEntityDiagramFiles: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/diagram-files',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: ws.extend({ entityId: z.string() }) }))
      .output(z.array(diagramEntityFileSchema)),
    listEntityFiles: oc
      .route({
        method: 'GET',
        path: '/{workspace}/entities/{entityId}/content',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: ws.extend({ entityId: z.string() }) }))
      .output(fileTreeSchema),
    createEntityFolder: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/content/folders',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws.extend({ entityId: z.string() }),
        body: z.object({ path: z.string() })
      }))
      .output(createFolderResponseSchema),
    createEntityFile: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/content/files',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws.extend({ entityId: z.string() }),
        query: z.object({ path: z.string() }),
        body: z.record(z.string(), z.unknown())
      }))
      .output(projectFileSchema),
    listWorkspaceFiles: oc
      .route({
        method: 'GET',
        path: '/{workspace}/content',
        inputStructure: 'detailed'
      })
      .input(z.object({ params: ws }))
      .output(fileTreeSchema),
    createWorkspaceFolder: oc
      .route({
        method: 'POST',
        path: '/{workspace}/content/folders',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws,
        body: z.object({ path: z.string() })
      }))
      .output(createFolderResponseSchema),
    createWorkspaceFile: oc
      .route({
        method: 'POST',
        path: '/{workspace}/content/files',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws,
        query: z.object({ path: z.string() }),
        body: z.record(z.string(), z.unknown())
      }))
      .output(projectFileSchema),
    getWorkspaceFileContent: oc
      .route({
        method: 'GET',
        path: '/{workspace}/content/files/content',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws,
        query: z.object({ path: z.string() })
      }))
      .output(z.record(z.string(), z.unknown())),
    saveWorkspaceFile: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/content/files',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws,
        query: z.object({ path: z.string() }),
        body: z.record(z.string(), z.unknown())
      }))
      .output(projectFileSchema),
    createProjectMarkdown: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/markdown',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: wsAndId,
        body: z.object({ name: z.string(), folder: z.string().optional() })
      }))
      .output(projectFileSchema),
    createEntityMarkdown: oc
      .route({
        method: 'POST',
        path: '/{workspace}/entities/{entityId}/markdown',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws.extend({ entityId: z.string() }),
        body: z.object({ name: z.string(), folder: z.string().optional() })
      }))
      .output(projectFileSchema),
    createWorkspaceMarkdown: oc
      .route({
        method: 'POST',
        path: '/{workspace}/content/markdown',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws,
        body: z.object({ name: z.string(), folder: z.string().optional() })
      }))
      .output(projectFileSchema),
    getMarkdownContent: oc
      .route({
        method: 'GET',
        path: '/{workspace}/markdown/{nodeId}',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws.extend({ nodeId: z.string() })
      }))
      .output(z.object({ body: z.string() })),
    saveMarkdownContent: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/markdown/{nodeId}',
        inputStructure: 'detailed'
      })
      .input(z.object({
        params: ws.extend({ nodeId: z.string() }),
        body: z.object({ body: z.string(), name: z.string().optional() })
      }))
      .output(projectFileSchema)
  }
};

export type Project = z.infer<typeof projectSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;
export type FileTree = z.infer<typeof fileTreeSchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type ProjectEntity = z.infer<typeof projectEntitySchema>;
export type DiagramEntityFile = z.infer<typeof diagramEntityFileSchema>;
