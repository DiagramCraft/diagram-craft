import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const wsAndMilestoneId = ws.extend({
  milestoneId: z.string().describe('Milestone identifier')
});

const milestoneStatusSchema = z
  .enum(['planned', 'active', 'complete', 'cancelled'])
  .describe('Milestone status');

const milestoneSchema = z.object({
  id: z.string().describe('Unique milestone identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  project_id: z.string().describe('Parent project identifier'),
  name: z.string().describe('Milestone name (must be unique within the project)'),
  target_date: z.string().describe('Target date for this milestone (ISO 8601)'),
  status: milestoneStatusSchema,
  sort_order: z.number().int().describe("Display order among the project's milestones"),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const milestoneBodySchema = z.object({
  project_id: z.string().describe('Parent project identifier'),
  name: z.string().describe('Milestone name (must be unique within the project)'),
  target_date: z.string().describe('Target date for this milestone (ISO 8601)'),
  status: milestoneStatusSchema.optional(),
  sort_order: z.preprocess(
    value => (typeof value === 'number' ? value : undefined),
    z.number().int().optional().describe("Display order among the project's milestones")
  )
});

export const milestoneContract = oc.tag('Milestones').router({
  milestones: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/milestones',
        inputStructure: 'detailed',
        summary: 'List workspace milestones',
        description: 'Retrieves all milestones defined for projects in the workspace.',
        tags: ['Milestones']
      })
      .input(z.object({ params: ws, query: z.object({ project_id: z.string().optional() }) }))
      .output(z.array(milestoneSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/milestones/{milestoneId}',
        inputStructure: 'detailed',
        summary: 'Get milestone details',
        description: 'Retrieves a specific milestone by ID.',
        tags: ['Milestones']
      })
      .input(z.object({ params: wsAndMilestoneId }))
      .output(milestoneSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/milestones',
        inputStructure: 'detailed',
        summary: 'Create milestone',
        description: 'Creates a new milestone within the project.',
        tags: ['Milestones']
      })
      .input(z.object({ params: ws, body: milestoneBodySchema }))
      .output(milestoneSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/milestones/{milestoneId}',
        inputStructure: 'detailed',
        summary: 'Update milestone',
        description: 'Updates an existing milestone, including its status.',
        tags: ['Milestones']
      })
      .input(z.object({ params: wsAndMilestoneId, body: milestoneBodySchema }))
      .output(milestoneSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/milestones/{milestoneId}',
        inputStructure: 'detailed',
        summary: 'Delete milestone',
        description:
          'Permanently deletes a milestone. Any entity change targeting it has its milestone ' +
          'cleared and its target date backfilled from the milestone target date.',
        tags: ['Milestones']
      })
      .input(z.object({ params: wsAndMilestoneId }))
      .output(
        z.object({
          success: z.boolean().describe('Whether the deletion was successful'),
          message: z.string().describe('Status message or error details')
        })
      )
  }
});

export type Milestone = z.infer<typeof milestoneSchema>;
export type CreateMilestoneRequest = z.infer<typeof milestoneBodySchema>;
export type UpdateMilestoneRequest = CreateMilestoneRequest;
