import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';
import { jobRunListQuerySchema, jobRunPageSchema } from '@arch-register/api-types/jobsContract';

export const automationRuleTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('entity_created') }),
  z.object({ kind: z.literal('entity_deleted') }),
  z.object({ kind: z.literal('field_changed'), field: z.string().min(1) }),
  z.object({
    kind: z.literal('lifecycle_transition'),
    from: z.string().min(1).nullable().optional(),
    to: z.string().min(1).nullable().optional()
  })
]);

export const automationConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'is_empty',
  'is_not_empty'
]);

export const automationConditionSchema = z.object({
  field: z.string().min(1),
  operator: automationConditionOperatorSchema,
  value: z.unknown().optional()
});

export const automationNotificationRecipientSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), userId: z.string().min(1) }),
  z.object({ kind: z.literal('owner_team') }),
  z.object({ kind: z.literal('reference_owner'), field: z.string().min(1) })
]);

export const automationActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create_audit_note'), note: z.string().min(1) }),
  z.object({
    kind: z.literal('send_notification'),
    recipient: automationNotificationRecipientSchema,
    message: z.string().min(1)
  }),
  z.object({
    kind: z.literal('set_field_value'),
    field: z.string().min(1),
    value: z.unknown()
  })
]);

const automationRuleSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  schema_id: z.string().nullable(),
  trigger: automationRuleTriggerSchema,
  conditions: z.array(automationConditionSchema),
  actions: z.array(automationActionSchema).min(1),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

const automationRuleInputSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  schema_id: z.string().min(1).nullable().optional(),
  trigger: automationRuleTriggerSchema,
  conditions: z.array(automationConditionSchema).default([]),
  actions: z.array(automationActionSchema).min(1),
  enabled: z.boolean().default(true)
});

export const automationRuleContract = oc.tag('Automation Rules').router({
  automationRules: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/automation-rules',
        inputStructure: 'detailed',
        tags: ['Automation Rules']
      })
      .input(z.object({ params: ws }))
      .output(z.array(automationRuleSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/automation-rules',
        inputStructure: 'detailed',
        tags: ['Automation Rules']
      })
      .input(z.object({ params: ws, body: automationRuleInputSchema }))
      .output(automationRuleSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/automation-rules/{id}',
        inputStructure: 'detailed',
        tags: ['Automation Rules']
      })
      .input(z.object({ params: wsAndUUID, body: automationRuleInputSchema }))
      .output(automationRuleSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/automation-rules/{id}',
        inputStructure: 'detailed',
        tags: ['Automation Rules']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(z.object({ success: z.boolean() })),
    runs: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/automation-rules/runs',
          inputStructure: 'detailed',
          tags: ['Automation Rules']
        })
        .input(z.object({ params: ws, query: jobRunListQuerySchema }))
        .output(jobRunPageSchema)
    }
  }
});

export type AutomationRule = z.infer<typeof automationRuleSchema>;
export type AutomationRuleInput = z.infer<typeof automationRuleInputSchema>;
export type AutomationRuleTrigger = z.infer<typeof automationRuleTriggerSchema>;
export type AutomationCondition = z.infer<typeof automationConditionSchema>;
export type AutomationConditionOperator = z.infer<typeof automationConditionOperatorSchema>;
export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationNotificationRecipient = z.infer<typeof automationNotificationRecipientSchema>;
