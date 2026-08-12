import { oc } from '@orpc/contract';
import { z } from 'zod';
import { foreignKeySchema, ws, wsAndId } from '@arch-register/api-types/common';
import { projectSchema } from './projectCrudContract';
import { projectFileSchema } from './projectContentContract';

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

export const projectEntityContract = {
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
    .input(z.object({ params: ws.extend({ entityId: z.string().describe('Entity identifier') }) }))
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
      z.object({
        params: wsAndId.extend({ entityId: z.string().describe('Entity identifier') })
      })
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
    .input(z.object({ params: ws.extend({ entityId: z.string().describe('Entity identifier') }) }))
    .output(z.array(diagramEntityFileSchema))
};

export type ProjectEntity = z.infer<typeof projectEntitySchema>;
export type EntityProject = z.infer<typeof entityProjectSchema>;
export type DiagramEntityFile = z.infer<typeof diagramEntityFileSchema>;
