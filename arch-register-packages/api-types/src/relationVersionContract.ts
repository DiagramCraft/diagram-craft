import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';

const wsRelationAndVersionId = wsAndId.extend({
  versionId: z.string().describe('Relation version identifier')
});

const relationVersionKindSchema = z
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

export const relationVersionSchema = z.object({
  id: z.string().describe('Version identifier'),
  workspace: z.string().describe('Workspace identifier'),
  record_id: z.string().describe('Catalog record identifier'),
  version_number: z.number().describe('Sequential version number for this relation instance'),
  kind: relationVersionKindSchema,
  commit_message: z.string().nullable().describe('Commit message describing the version'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  created_by: z.string().nullable().describe('User who created the version'),
  created_by_name: z.string().nullable().describe('Display name of creator'),
  state: z.record(z.string(), z.unknown()).describe('Relation state captured by this version')
});

const restoreRelationVersionBodySchema = z.object({
  commitMessage: z.string().optional().describe('Commit message for the restore operation')
});

export const relationVersionContract = oc.tag('RelationVersions').router({
  relationVersions: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relations/{id}/versions',
        inputStructure: 'detailed',
        summary: 'List relation instance versions',
        description:
          'Retrieves the version history for a relation instance, including autosaves and the ' +
          'deleted marker written when the relation is deleted.',
        tags: ['RelationVersions']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(relationVersionSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relations/{id}/versions/{versionId}',
        inputStructure: 'detailed',
        summary: 'Get a relation instance version',
        description: 'Retrieves a single relation instance version by identifier.',
        tags: ['RelationVersions']
      })
      .input(z.object({ params: wsRelationAndVersionId }))
      .output(relationVersionSchema),
    restore: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relations/{id}/versions/{versionId}/restore',
        inputStructure: 'detailed',
        summary: 'Restore a relation instance to a previous version',
        description:
          'Restores a relation instance to the field data captured by a previous version, ' +
          'creating a new version in the process. The "in"/"out" endpoints cannot be restored ' +
          'since they are immutable after creation.',
        tags: ['RelationVersions']
      })
      .input(z.object({ params: wsRelationAndVersionId, body: restoreRelationVersionBodySchema }))
      .output(relationVersionSchema)
  }
});

export type RelationVersion = z.infer<typeof relationVersionSchema>;
export type RelationVersionKind = z.infer<typeof relationVersionKindSchema>;
export type RestoreRelationVersionRequest = z.infer<typeof restoreRelationVersionBodySchema>;
