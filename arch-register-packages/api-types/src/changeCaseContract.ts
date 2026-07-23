import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';

const wsProjectAndCaseId = wsAndId.extend({
  caseId: z.string().describe('Change case identifier')
});

const wsProjectCaseAndMemberId = wsProjectAndCaseId.extend({
  memberId: z.string().describe('Change case member identifier')
});

const changeCaseStatusSchema = z
  .enum(['planned', 'in_approval', 'applied', 'rejected', 'withdrawn', 'cancelled', 'superseded'])
  .describe('Change case lifecycle status');

const changeCaseMemberSchema = z.object({
  id: z.string().describe('Member identifier'),
  entity_id: z.string().describe('Affected entity identifier'),
  base_version: z.number().describe('Entity version this member was planned against'),
  base_state: z.record(z.string(), z.unknown()).describe('Entity state at planning time'),
  proposed_state: z.record(z.string(), z.unknown()).describe('Proposed future state'),
  applied_version_id: z
    .string()
    .nullable()
    .describe('Resulting entity_version id once this member has been applied')
});

const changeCaseSchema = z.object({
  id: z.string().describe('Change case identifier'),
  workspace: z.string().describe('Workspace identifier'),
  project_id: z.string().nullable().describe('Associated project identifier'),
  status: changeCaseStatusSchema,
  name: z.string().nullable().describe('Case name'),
  description: z.string().nullable().describe('Case description'),
  target_date: z.string().nullable().describe('Target date for the case (ISO 8601)'),
  milestone_id: z.string().nullable().describe('Associated milestone identifier'),
  commit_message: z.string().nullable().describe('Commit message describing the changes'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp'),
  members: z.array(changeCaseMemberSchema).describe('Entities affected by this case')
});

const changeCaseMemberBodySchema = z.object({
  entityId: z.string().describe('Entity to include in the case'),
  proposedState: z.record(z.string(), z.unknown()).describe('Proposed future state for the entity')
});

const createChangeCaseBodySchema = z
  .object({
    name: z.string().min(1, 'Case name is required').describe('Case name'),
    description: z.string().nullable().optional().describe('Case description'),
    targetDate: z.string().nullable().optional().describe('Target date (ISO 8601)'),
    milestoneId: z.string().nullable().optional().describe('Milestone identifier'),
    commitMessage: z.string().nullable().optional().describe('Commit message'),
    members: z.array(changeCaseMemberBodySchema).min(1).describe('Entities included in the case')
  })
  .refine(body => !(body.targetDate != null && body.milestoneId != null), {
    message: 'A change case cannot specify both a target date and a milestone'
  });

const updateChangeCaseBodySchema = z.object({
  name: z.string().min(1, 'Case name is required').optional().describe('Case name'),
  targetDate: z.string().nullable().optional().describe('Target date (ISO 8601)'),
  milestoneId: z.string().nullable().optional().describe('Milestone identifier'),
  commitMessage: z.string().nullable().optional().describe('Commit message')
});

const changeCaseApplyConflictSchema = z.object({
  memberId: z.string().describe('Member identifier'),
  entityId: z.string().describe('Affected entity identifier'),
  baseVersion: z.number().describe('Entity version this member was planned against'),
  currentVersion: z.number().describe('Current live entity version'),
  stale: z.boolean().describe('Whether the entity changed since this member was planned')
});

const applyChangeCaseBodySchema = z.object({
  resolutions: z
    .array(
      z.object({
        memberId: z.string().describe('Member identifier'),
        resolvedEntityData: z
          .record(z.string(), z.unknown())
          .describe('Final entity state to apply, with any conflicts resolved')
      })
    )
    .min(1)
    .describe('Resolved state for every member of the case')
});

export const changeCaseContract = oc.tag('ChangeCases').router({
  changeCases: {
    listByProject: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/change-cases',
        inputStructure: 'detailed',
        summary: 'List project change cases',
        description: 'Retrieves all multi-entity planned change cases for the project.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(changeCaseSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/change-cases/{caseId}',
        inputStructure: 'detailed',
        summary: 'Get change case details',
        description: 'Retrieves a specific change case, including all its member entities.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsProjectAndCaseId }))
      .output(changeCaseSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/change-cases',
        inputStructure: 'detailed',
        summary: 'Create a multi-entity change case',
        description: 'Creates a new planned change case covering one or more entities.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsAndId, body: createChangeCaseBodySchema }))
      .output(changeCaseSchema),
    addMember: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/change-cases/{caseId}/members',
        inputStructure: 'detailed',
        summary: 'Add an entity to an existing change case',
        description: 'Adds a new member entity to a not-yet-applied change case.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsProjectAndCaseId, body: changeCaseMemberBodySchema }))
      .output(changeCaseSchema),
    removeMember: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}/change-cases/{caseId}/members/{memberId}',
        inputStructure: 'detailed',
        summary: 'Remove an entity from a change case',
        description: 'Removes a member entity from a not-yet-applied change case.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsProjectCaseAndMemberId }))
      .output(changeCaseSchema),
    updateMember: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/change-cases/{caseId}/members/{memberId}',
        inputStructure: 'detailed',
        summary: "Update a member's proposed state",
        description: "Updates a single member entity's proposed future state within the case.",
        tags: ['ChangeCases']
      })
      .input(
        z.object({
          params: wsProjectCaseAndMemberId,
          body: z.object({
            proposedState: z.record(z.string(), z.unknown()).describe('Proposed future state')
          })
        })
      )
      .output(changeCaseSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/change-cases/{caseId}',
        inputStructure: 'detailed',
        summary: 'Update change case fields',
        description: 'Updates the shared target date/milestone or commit message for the case.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsProjectAndCaseId, body: updateChangeCaseBodySchema }))
      .output(changeCaseSchema),
    checkApplyConflicts: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/change-cases/{caseId}/apply-conflicts',
        inputStructure: 'detailed',
        summary: 'Check for base-version conflicts before applying',
        description:
          'Validates every member entity for base-version drift against its planned base version.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsProjectAndCaseId }))
      .output(z.array(changeCaseApplyConflictSchema)),
    apply: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/change-cases/{caseId}/apply',
        inputStructure: 'detailed',
        summary: 'Apply a change case',
        description:
          'Applies every member entity update in one atomic transaction, after re-validating ' +
          'base versions.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsProjectAndCaseId, body: applyChangeCaseBodySchema }))
      .output(changeCaseSchema),
    withdraw: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/change-cases/{caseId}/withdraw',
        inputStructure: 'detailed',
        summary: 'Withdraw a change case',
        description: 'Withdraws a not-yet-applied change case without applying any of its members.',
        tags: ['ChangeCases']
      })
      .input(z.object({ params: wsProjectAndCaseId }))
      .output(changeCaseSchema)
  }
});

export type ChangeCase = z.infer<typeof changeCaseSchema>;
export type ChangeCaseMember = z.infer<typeof changeCaseMemberSchema>;
export type CreateChangeCaseRequest = z.infer<typeof createChangeCaseBodySchema>;
export type UpdateChangeCaseRequest = z.infer<typeof updateChangeCaseBodySchema>;
export type ChangeCaseApplyConflict = z.infer<typeof changeCaseApplyConflictSchema>;
export type ApplyChangeCaseRequest = z.infer<typeof applyChangeCaseBodySchema>;
