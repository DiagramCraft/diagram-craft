import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId, foreignKeySchema } from '@arch-register/api-types/common';
import { entityRecordSchema } from '@arch-register/api-types/entityContract';
import { relationRecordSchema } from '@arch-register/api-types/relationContract';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';

export const baselineStatusSchema = z
  .enum(['active', 'stale', 'superseded'])
  .describe('Lifecycle status of a named architecture baseline');

export const baselineScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('workspace') }),
  z.object({
    kind: z.literal('project'),
    projectId: z.string(),
    projectScope: z.enum(['project', 'all']).default('project')
  }),
  z.object({
    kind: z.literal('saved_view'),
    viewId: z.string()
  }),
  z.object({
    kind: z.literal('selection'),
    entityIds: z.array(z.string()).min(1).max(1000)
  })
]);

export const baselineScopeSnapshotSchema = z.object({
  source: baselineScopeSchema,
  query: entityQuerySchema.nullable().describe('Canonical query captured with the baseline')
});

export const baselineSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ownerTeam: foreignKeySchema.nullable(),
  createdBy: foreignKeySchema.nullable(),
  effectiveAt: z.string(),
  scope: baselineScopeSnapshotSchema,
  includePlannedChanges: z.boolean(),
  includeOverdueChanges: z.boolean(),
  status: baselineStatusSchema,
  supersededById: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  entityCount: z.number().int().nonnegative(),
  relationCount: z.number().int().nonnegative()
});

export const baselineLinkTargetTypeSchema = z.enum([
  'project',
  'milestone',
  'planned_change',
  'document',
  'governance_case'
]);

export const baselineLinkSchema = z.object({
  id: z.string(),
  targetType: baselineLinkTargetTypeSchema,
  targetId: z.string(),
  createdBy: foreignKeySchema.nullable(),
  createdAt: z.string()
});

export const baselineDetailSchema = baselineSummarySchema.extend({
  entities: z.array(entityRecordSchema),
  relations: z.array(relationRecordSchema),
  links: z.array(baselineLinkSchema)
});

export const createBaselineBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  ownerTeamId: z.string().nullable().optional(),
  effectiveAt: z.string().refine(value => !Number.isNaN(Date.parse(value)), 'Invalid effectiveAt'),
  scope: baselineScopeSchema,
  query: entityQuerySchema
    .nullable()
    .optional()
    .describe('Optional current entity query to capture alongside the selected scope'),
  includePlannedChanges: z.boolean().default(true),
  includeOverdueChanges: z.boolean().default(false)
});

export const baselineDiffRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('baseline'), id: z.string() }),
  z.object({ kind: z.literal('current') })
]);

export const baselineDiffSchema = z.object({
  added: z.array(entityRecordSchema),
  removed: z.array(entityRecordSchema),
  changed: z.array(
    z.object({
      entity: entityRecordSchema,
      diff: z.record(
        z.string(),
        z.object({
          current: z.unknown().nullable().optional(),
          before: z.unknown().nullable(),
          after: z.unknown().nullable()
        })
      )
    })
  ),
  relations: z.object({
    added: z.array(relationRecordSchema),
    removed: z.array(relationRecordSchema),
    changed: z.array(
      z.object({
        relation: relationRecordSchema,
        diff: z.record(
          z.string(),
          z.object({
            current: z.unknown().nullable().optional(),
            before: z.unknown().nullable(),
            after: z.unknown().nullable()
          })
        )
      })
    )
  })
});

export const baselineContract = oc.tag('Baselines').router({
  baselines: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/baselines',
        inputStructure: 'detailed',
        summary: 'List architecture baselines',
        description: 'Lists named architecture baselines visible in the workspace.',
        tags: ['Baselines']
      })
      .input(
        z.object({ params: ws, query: z.object({ includeDeleted: z.coerce.boolean().optional() }) })
      )
      .output(z.array(baselineSummarySchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/baselines',
        inputStructure: 'detailed',
        summary: 'Create an architecture baseline',
        description: 'Captures a named, immutable point-in-time catalog state.',
        tags: ['Baselines']
      })
      .input(z.object({ params: ws, body: createBaselineBodySchema }))
      .output(baselineSummarySchema),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/baselines/{id}',
        inputStructure: 'detailed',
        summary: 'Get an architecture baseline',
        description: 'Returns a baseline and its permission-filtered catalog snapshot.',
        tags: ['Baselines']
      })
      .input(z.object({ params: wsAndId }))
      .output(baselineDetailSchema),
    diff: oc
      .route({
        method: 'POST',
        path: '/{workspace}/baselines/diff',
        inputStructure: 'detailed',
        summary: 'Compare architecture baselines',
        description: 'Compares two stored baselines or a baseline with its current scope.',
        tags: ['Baselines']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            from: baselineDiffRefSchema,
            to: baselineDiffRefSchema
          })
        })
      )
      .output(baselineDiffSchema),
    supersede: oc
      .route({
        method: 'POST',
        path: '/{workspace}/baselines/{id}/supersede',
        inputStructure: 'detailed',
        summary: 'Supersede an architecture baseline',
        description: 'Marks a baseline as superseded by another baseline.',
        tags: ['Baselines']
      })
      .input(z.object({ params: wsAndId, body: z.object({ replacementId: z.string() }) }))
      .output(baselineSummarySchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/baselines/{id}',
        inputStructure: 'detailed',
        summary: 'Soft-delete an architecture baseline',
        description: 'Hides a baseline without removing its historical evidence.',
        tags: ['Baselines']
      })
      .input(z.object({ params: wsAndId }))
      .output(baselineSummarySchema),
    export: oc
      .route({
        method: 'GET',
        path: '/{workspace}/baselines/{id}/export',
        inputStructure: 'detailed',
        summary: 'Export an architecture baseline',
        description: 'Exports the permission-filtered baseline as a JSON document.',
        tags: ['Baselines']
      })
      .input(z.object({ params: wsAndId }))
      .output(baselineDetailSchema),
    links: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/baselines/{id}/links',
          inputStructure: 'detailed',
          summary: 'List baseline references',
          description:
            'Lists project, document, milestone, planned-change, and governance references.',
          tags: ['Baselines']
        })
        .input(z.object({ params: wsAndId }))
        .output(z.array(baselineLinkSchema)),
      create: oc
        .route({
          method: 'POST',
          path: '/{workspace}/baselines/{id}/links',
          inputStructure: 'detailed',
          summary: 'Create a baseline reference',
          description: 'References a baseline from a project or governance-related resource.',
          tags: ['Baselines']
        })
        .input(
          z.object({
            params: wsAndId,
            body: z.object({
              targetType: baselineLinkTargetTypeSchema,
              targetId: z.string()
            })
          })
        )
        .output(baselineLinkSchema),
      remove: oc
        .route({
          method: 'DELETE',
          path: '/{workspace}/baselines/{id}/links/{linkId}',
          inputStructure: 'detailed',
          summary: 'Remove a baseline reference',
          description: 'Removes a reference without changing the baseline snapshot.',
          tags: ['Baselines']
        })
        .input(
          z.object({
            params: z.object({ workspace: z.string(), id: z.string(), linkId: z.string() })
          })
        )
        .output(baselineLinkSchema)
    }
  }
});

export type Baseline = z.infer<typeof baselineSummarySchema>;
export type BaselineDetail = z.infer<typeof baselineDetailSchema>;
export type BaselineLinkTargetType = z.infer<typeof baselineLinkTargetTypeSchema>;
export type CreateBaselineRequest = z.infer<typeof createBaselineBodySchema>;
export type BaselineScope = z.infer<typeof baselineScopeSchema>;
