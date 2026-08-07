import { z } from 'zod';

/**
 * Shape of the generalized `workspace_governance_case_config.config` JSONB blob for governance
 * case kinds whose only configurable behavior is scheduled deadline reminders and escalation —
 * the same fields `governanceReminderConfigContract.ts` exposes today. Validated at the API
 * boundary only; the DB column itself is an opaque JSONB blob (see #2818).
 */
export const reminderCaseConfigSchema = z.object({
  approaching_days: z
    .array(z.number().int().min(0))
    .describe('Days before due_at at which an approaching-deadline reminder is sent'),
  overdue_days: z
    .array(z.number().int().min(0))
    .describe('Days past due_at at which an overdue reminder is sent'),
  escalation_enabled: z
    .boolean()
    .describe('Whether overdue cases of this kind escalate to the code-defined escalation target')
});

export type ReminderCaseConfig = z.infer<typeof reminderCaseConfigSchema>;

export const fieldDateReminderCaseConfigSchema = z.object({
  approaching_days: z
    .array(z.number().int().min(0))
    .describe('Days before the field date at which an approaching reminder is sent'),
  overdue_days: z
    .array(z.number().int().min(0))
    .describe('Days after the field date at which an overdue reminder is sent')
});

export type FieldDateReminderCaseConfig = z.infer<typeof fieldDateReminderCaseConfigSchema>;

export const documentStatusApprovalSchema = z.object({
  required: z.boolean(),
  requiredApprovals: z.number().int().positive().optional(),
  approverFieldId: z.string().min(1).optional(),
  fallbackUserIds: z.array(z.string().min(1)).default([]),
  fallbackTeamIds: z.array(z.string().min(1)).default([])
});

export const documentStatusApprovalConfigSchema = z.object({
  statuses: z.record(z.string(), documentStatusApprovalSchema)
});

export type DocumentStatusApproval = z.infer<typeof documentStatusApprovalSchema>;
export type DocumentStatusApprovalConfig = z.infer<typeof documentStatusApprovalConfigSchema>;
