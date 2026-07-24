import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';

const wsEntityAndVersionId = wsAndId.extend({
  versionId: z.string().describe('Entity version identifier')
});

const entityVersionKindSchema = z
  .enum([
    'autosave',
    'saved_version',
    'deleted',
    'restored',
    'direct_edit',
    'case_applied',
    'bypass'
  ])
  .describe('How this version came to exist');

const entityVersionSchema = z.object({
  id: z.string().describe('Version identifier'),
  workspace: z.string().describe('Workspace identifier'),
  entity_id: z.string().describe('Entity identifier'),
  version_number: z.number().describe('Sequential version number for this entity'),
  kind: entityVersionKindSchema,
  commit_message: z.string().nullable().describe('Commit message describing the version'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  created_by: z.string().nullable().describe('User who created the version'),
  created_by_name: z.string().nullable().describe('Display name of creator'),
  state: z.record(z.string(), z.unknown()).describe('Entity state captured by this version')
});

const promoteEntityVersionBodySchema = z.object({
  commitMessage: z.string().optional().describe('Commit message for the saved version')
});

const restoreEntityVersionBodySchema = z.object({
  commitMessage: z.string().optional().describe('Commit message for the restore operation')
});

export const entityVersionContract = oc.tag('EntityVersions').router({
  entityVersions: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/versions',
        inputStructure: 'detailed',
        summary: 'List entity versions',
        description:
          'Retrieves the version history for an entity, including autosaves and saved versions.',
        tags: ['EntityVersions']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(entityVersionSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/versions/{versionId}',
        inputStructure: 'detailed',
        summary: 'Get an entity version',
        description: 'Retrieves a single entity version by identifier.',
        tags: ['EntityVersions']
      })
      .input(z.object({ params: wsEntityAndVersionId }))
      .output(entityVersionSchema),
    promote: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/versions/{versionId}/promote',
        inputStructure: 'detailed',
        summary: 'Promote an autosave version to a saved version',
        description: 'Promotes an autosave version to a saved version, making it permanent.',
        tags: ['EntityVersions']
      })
      .input(z.object({ params: wsEntityAndVersionId, body: promoteEntityVersionBodySchema }))
      .output(entityVersionSchema),
    restore: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/{id}/versions/{versionId}/restore',
        inputStructure: 'detailed',
        summary: 'Restore an entity to a previous version',
        description:
          'Restores an entity to the state captured by a previous version, creating a new version in the process.',
        tags: ['EntityVersions']
      })
      .input(z.object({ params: wsEntityAndVersionId, body: restoreEntityVersionBodySchema }))
      .output(entityVersionSchema)
  }
});

export type EntityVersion = z.infer<typeof entityVersionSchema>;
export type EntityVersionKind = z.infer<typeof entityVersionKindSchema>;
export type PromoteEntityVersionRequest = z.infer<typeof promoteEntityVersionBodySchema>;
export type RestoreEntityVersionRequest = z.infer<typeof restoreEntityVersionBodySchema>;
