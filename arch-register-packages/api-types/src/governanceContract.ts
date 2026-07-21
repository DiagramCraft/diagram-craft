import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId } from '@arch-register/api-types/common';

// ── Shared sub-schemas ────────────────────────────────────────

const governanceCaseStatusSchema = z.enum(['open', 'completed', 'cancelled']);

const governanceAssignmentActionSchema = z.enum(['approve', 'acknowledge', 'review', 'remediate']);

const governanceAssignmentTargetTypeSchema = z.enum(['user', 'team', 'team_role', 'capability']);

const governanceEventTypeSchema = z.enum([
  'submitted',
  'assigned',
  'reassigned',
  'changes_requested',
  'resubmitted',
  'approved',
  'rejected',
  'acknowledged',
  'cancelled',
  'admin_override',
  'proposal_stale',
  'domain_effect_applied',
  'domain_effect_failed',
  'scope_refreshed',
  'postponed',
  'finalized',
  'finalization_override'
]);

const governanceDecisionActionSchema = z.enum([
  'approve',
  'reject',
  'request_changes',
  'acknowledge'
]);

const governanceCaseSchema = z.object({
  id: z.string().describe('Unique case identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  caseKind: z
    .string()
    .describe('Domain-specific kind of governed process, e.g. entity change approval'),
  subjectType: z.string().describe('Kind of resource this case governs, e.g. "entity"'),
  subjectId: z.string().describe('Identifier of the resource this case governs'),
  subjectVersion: z
    .string()
    .nullable()
    .describe('Immutable subject version or proposal revision being reviewed'),
  status: governanceCaseStatusSchema.describe('Generic lifecycle status'),
  outcome: z.string().nullable().describe('Domain-specific outcome, e.g. "approve" or "reject"'),
  policyVersion: z
    .string()
    .nullable()
    .describe('Applicable policy version captured when the case started'),
  initiatorUserId: z
    .string()
    .nullable()
    .describe('User who opened the case, or null if the user was deleted'),
  parentCaseId: z
    .string()
    .nullable()
    .describe('Parent case identifier, for future compound operations'),
  selfApprovalAllowed: z
    .boolean()
    .describe('Whether the captured policy allows the initiator to decide their own case'),
  payload: z
    .record(z.string(), z.unknown())
    .describe('Opaque domain payload reference, e.g. a proposal revision id'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  dueAt: z.string().nullable().describe('ISO 8601 due timestamp'),
  completedAt: z.string().nullable().describe('ISO 8601 completion timestamp'),
  cancelledAt: z.string().nullable().describe('ISO 8601 cancellation timestamp')
});

const governanceAssignmentSchema = z.object({
  id: z.string().describe('Unique assignment identifier'),
  caseId: z.string().describe('Case this assignment belongs to'),
  action: governanceAssignmentActionSchema.describe(
    'Action expected from whoever completes this assignment'
  ),
  targetType: governanceAssignmentTargetTypeSchema.describe('Kind of eligibility target'),
  targetUserId: z.string().nullable().describe('Specific eligible user, when targetType is "user"'),
  targetTeamId: z.string().nullable().describe('Owner team, when targetType is "team_role"'),
  targetTeamRole: z
    .string()
    .nullable()
    .describe('Required team role, when targetType is "team_role"'),
  targetCapability: z
    .string()
    .nullable()
    .describe('Required workspace capability, when targetType is "capability"'),
  status: z.enum(['open', 'completed', 'superseded']).describe('Assignment status'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  resolvedAt: z
    .string()
    .nullable()
    .describe('ISO 8601 timestamp the assignment was completed or superseded')
});

const governanceEventSchema = z.object({
  id: z.string().describe('Unique event identifier'),
  caseId: z.string().describe('Case this event belongs to'),
  eventType: governanceEventTypeSchema.describe('Kind of event'),
  actorUserId: z
    .string()
    .nullable()
    .describe('User who performed the action, or null for system events / deleted users'),
  occurredAt: z.string().describe('ISO 8601 timestamp the event occurred'),
  previousStatus: z.string().nullable().describe('Case status before this event'),
  resultingStatus: z.string().nullable().describe('Case status after this event'),
  reason: z.string().nullable().describe('Optional reason or comment supplied by the actor'),
  metadata: z.record(z.string(), z.unknown()).describe('Structured, non-executable metadata')
});

const listGovernanceCasesQuerySchema = z.object({
  caseKind: z.string().optional().describe('Filter by case kind'),
  status: governanceCaseStatusSchema.optional().describe('Filter by case status'),
  subjectType: z.string().optional().describe('Filter by subject type'),
  subjectId: z.string().optional().describe('Filter by subject id')
});

const cancelGovernanceCaseBodySchema = z.object({
  reason: z.string().optional().describe('Optional reason for cancelling or withdrawing the case')
});

const decideGovernanceAssignmentBodySchema = z.object({
  decision: governanceDecisionActionSchema.describe('The decision being submitted'),
  reason: z.string().optional().describe('Optional reason or comment, required by some decisions'),
  idempotencyKey: z
    .string()
    .min(1)
    .describe('Client-supplied key; retrying the same decision with the same key is a no-op')
});

const decideGovernanceAssignmentResponseSchema = z.object({
  case: governanceCaseSchema,
  event: governanceEventSchema
});

const governanceTaskSchema = z.object({
  assignment: governanceAssignmentSchema,
  case: governanceCaseSchema,
  requiresAction: z.boolean().describe('Whether the task is currently actionable by the user')
});

const listGovernanceTasksQuerySchema = z.object({
  caseKind: z.string().optional(),
  taskKind: governanceAssignmentActionSchema.optional(),
  state: z.enum(['open', 'completed', 'superseded', 'cancelled']).optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional()
});

const governanceSubmissionSchema = z.object({
  case: governanceCaseSchema,
  openAssignments: z
    .array(governanceAssignmentSchema)
    .describe('Assignments still open on this case, i.e. what the case is currently waiting on')
});

const listGovernanceSubmissionsQuerySchema = z.object({
  caseKind: z.string().optional().describe('Filter by case kind'),
  status: governanceCaseStatusSchema.optional().describe('Filter by case status')
});

// ── Contract ──────────────────────────────────────────────────

export const governanceContract = oc.tag('Governance').router({
  governance: {
    cases: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/governance/cases',
          inputStructure: 'detailed',
          summary: 'List governance cases',
          description: 'Lists governance cases visible to the current user in this workspace.',
          tags: ['Governance']
        })
        .input(
          z.object({
            params: ws,
            query: listGovernanceCasesQuerySchema
          })
        )
        .output(z.array(governanceCaseSchema)),
      get: oc
        .route({
          method: 'GET',
          path: '/{workspace}/governance/cases/{id}',
          inputStructure: 'detailed',
          summary: 'Get a governance case',
          description: 'Retrieves a single governance case, if visible to the current user.',
          tags: ['Governance']
        })
        .input(z.object({ params: wsAndId }))
        .output(governanceCaseSchema),
      events: oc
        .route({
          method: 'GET',
          path: '/{workspace}/governance/cases/{id}/events',
          inputStructure: 'detailed',
          summary: 'Get a case event history',
          description: 'Retrieves the append-only event history for a governance case.',
          tags: ['Governance']
        })
        .input(z.object({ params: wsAndId }))
        .output(z.array(governanceEventSchema)),
      cancel: oc
        .route({
          method: 'POST',
          path: '/{workspace}/governance/cases/{id}/cancel',
          inputStructure: 'detailed',
          summary: 'Cancel or withdraw a governance case',
          description: 'Cancels an open governance case. Only the case initiator may withdraw it.',
          tags: ['Governance']
        })
        .input(
          z.object({
            params: wsAndId,
            body: cancelGovernanceCaseBodySchema
          })
        )
        .output(governanceCaseSchema)
    },
    assignments: {
      mine: oc
        .route({
          method: 'GET',
          path: '/{workspace}/governance/assignments/mine',
          inputStructure: 'detailed',
          summary: "List the current user's actionable assignments",
          description: 'Lists open assignments the current user is eligible to decide.',
          tags: ['Governance']
        })
        .input(z.object({ params: ws, query: listGovernanceTasksQuerySchema }))
        .output(z.array(governanceTaskSchema)),
      count: oc
        .route({
          method: 'GET',
          path: '/{workspace}/governance/assignments/mine/count',
          inputStructure: 'detailed',
          summary: "Count the current user's open governance tasks",
          tags: ['Governance']
        })
        .input(z.object({ params: ws }))
        .output(z.object({ count: z.number() })),
      decide: oc
        .route({
          method: 'POST',
          path: '/{workspace}/governance/assignments/{id}/decisions',
          inputStructure: 'detailed',
          summary: 'Submit a decision for an assignment',
          description:
            'Submits a decision (approve, reject, request changes, or acknowledge) for an assignment. Idempotent for retried requests with the same idempotencyKey.',
          tags: ['Governance']
        })
        .input(
          z.object({
            params: wsAndId,
            body: decideGovernanceAssignmentBodySchema
          })
        )
        .output(decideGovernanceAssignmentResponseSchema)
    },
    submissions: {
      mine: oc
        .route({
          method: 'GET',
          path: '/{workspace}/governance/submissions/mine',
          inputStructure: 'detailed',
          summary: 'List governance cases the current user initiated',
          description:
            "Lists governance cases the current user initiated, along with each case's currently open assignments.",
          tags: ['Governance']
        })
        .input(z.object({ params: ws, query: listGovernanceSubmissionsQuerySchema }))
        .output(z.array(governanceSubmissionSchema))
    }
  }
});

export type GovernanceCase = z.infer<typeof governanceCaseSchema>;
export type GovernanceAssignment = z.infer<typeof governanceAssignmentSchema>;
export type GovernanceEvent = z.infer<typeof governanceEventSchema>;
export type GovernanceDecisionAction = z.infer<typeof governanceDecisionActionSchema>;
export type ListGovernanceCasesQuery = z.infer<typeof listGovernanceCasesQuerySchema>;
export type DecideGovernanceAssignmentBody = z.infer<typeof decideGovernanceAssignmentBodySchema>;
export type GovernanceTask = z.infer<typeof governanceTaskSchema>;
export type ListGovernanceTasksQuery = z.infer<typeof listGovernanceTasksQuerySchema>;
export type GovernanceSubmission = z.infer<typeof governanceSubmissionSchema>;
export type ListGovernanceSubmissionsQuery = z.infer<typeof listGovernanceSubmissionsQuerySchema>;
