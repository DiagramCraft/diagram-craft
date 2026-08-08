import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId } from '@arch-register/api-types/common';
import {
  governanceAssignmentActionSchema,
  governanceAssignmentSchema,
  governanceCaseSchema,
  governanceCaseStatusSchema,
  governanceDecisionActionSchema,
  governanceEventSchema
} from './governanceContract';

const targetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user'), userId: z.string().min(1) }),
  z.object({ type: z.literal('team'), teamId: z.string().min(1) }),
  z.object({
    type: z.literal('team_role'),
    teamId: z.string().min(1),
    teamRole: z.enum(['team_admin', 'team_editor', 'team_reviewer'])
  }),
  z.object({
    type: z.literal('capability'),
    capability: z.string().min(1)
  })
]);

const inboxItemCreateSchema = z.object({
  action: governanceAssignmentActionSchema,
  target: targetSchema,
  idempotencyKey: z.string().min(1)
});

const integrationCaseCreateSchema = z.object({
  caseKind: z.string().min(1),
  caseSubkind: z.string().nullable().optional(),
  dedupeKey: z.string().nullable().optional(),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  subjectVersion: z.string().nullable().optional(),
  policyVersion: z.string().nullable().optional(),
  selfApprovalAllowed: z.boolean().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  inboxItems: z.array(inboxItemCreateSchema.omit({ idempotencyKey: true })).default([]),
  idempotencyKey: z.string().min(1)
});

const listCasesQuerySchema = z.object({
  caseKind: z.string().optional(),
  status: governanceCaseStatusSchema.optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional()
});

const integrationDecisionSchema = z.object({
  decision: governanceDecisionActionSchema,
  reason: z.string().optional(),
  idempotencyKey: z.string().min(1)
});

const inboxItemResponseSchema = z.object({
  assignment: governanceAssignmentSchema,
  case: governanceCaseSchema
});

export const integrationGovernanceContract = oc.tag('Integrations').router({
  integrationGovernance: {
    cases: {
      list: oc
        .route({
          method: 'GET',
          path: '/integrations/v1/{workspace}/governance/cases',
          inputStructure: 'detailed',
          summary: 'List governance cases for integrations',
          tags: ['Integrations']
        })
        .input(z.object({ params: ws, query: listCasesQuerySchema }))
        .output(z.array(governanceCaseSchema)),
      create: oc
        .route({
          method: 'POST',
          path: '/integrations/v1/{workspace}/governance/cases',
          inputStructure: 'detailed',
          summary: 'Create a governance case for an external workflow',
          tags: ['Integrations']
        })
        .input(z.object({ params: ws, body: integrationCaseCreateSchema }))
        .output(governanceCaseSchema),
      get: oc
        .route({
          method: 'GET',
          path: '/integrations/v1/{workspace}/governance/cases/{id}',
          inputStructure: 'detailed',
          summary: 'Get a governance case for integrations',
          tags: ['Integrations']
        })
        .input(z.object({ params: wsAndId }))
        .output(governanceCaseSchema),
      listInboxItems: oc
        .route({
          method: 'GET',
          path: '/integrations/v1/{workspace}/governance/cases/{id}/inbox-items',
          inputStructure: 'detailed',
          summary: 'List governance inbox items for integrations',
          tags: ['Integrations']
        })
        .input(z.object({ params: wsAndId }))
        .output(z.array(inboxItemResponseSchema)),
      createInboxItem: oc
        .route({
          method: 'POST',
          path: '/integrations/v1/{workspace}/governance/cases/{id}/inbox-items',
          inputStructure: 'detailed',
          summary: 'Create a governance inbox item for integrations',
          tags: ['Integrations']
        })
        .input(z.object({ params: wsAndId, body: inboxItemCreateSchema }))
        .output(inboxItemResponseSchema)
    },
    inboxItems: {
      get: oc
        .route({
          method: 'GET',
          path: '/integrations/v1/{workspace}/governance/inbox-items/{id}',
          inputStructure: 'detailed',
          summary: 'Get a governance inbox item for integrations',
          tags: ['Integrations']
        })
        .input(z.object({ params: wsAndId }))
        .output(inboxItemResponseSchema),
      decide: oc
        .route({
          method: 'POST',
          path: '/integrations/v1/{workspace}/governance/inbox-items/{id}/decisions',
          inputStructure: 'detailed',
          summary: 'Decide a governance inbox item for integrations',
          tags: ['Integrations']
        })
        .input(z.object({ params: wsAndId, body: integrationDecisionSchema }))
        .output(z.object({ case: governanceCaseSchema, event: governanceEventSchema }))
    }
  }
});

export type IntegrationGovernanceCaseCreate = z.infer<typeof integrationCaseCreateSchema>;
export type IntegrationGovernanceInboxItemCreate = z.infer<typeof inboxItemCreateSchema>;
export type IntegrationGovernanceDecision = z.infer<typeof integrationDecisionSchema>;
export type IntegrationGovernanceTarget = z.infer<typeof targetSchema>;
export type IntegrationGovernanceInboxItem = z.infer<typeof inboxItemResponseSchema>;
