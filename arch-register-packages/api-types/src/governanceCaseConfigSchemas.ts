import { z } from 'zod';

const idListSchema = z.array(z.string().min(1)).default([]);

export const governanceApprovalConfigSchema = z.object({
  requiredApprovals: z.number().int().positive(),
  strategy: z.string().min(1).optional(),
  strategyConfig: z.record(z.string(), z.unknown()).default({}),
  fallbackTeamIds: idListSchema,
  fallbackUserIds: idListSchema
});

export const governanceReminderConfigSchema = z.object({
  enabled: z.boolean(),
  approachingDays: z.array(z.number().int().min(0)),
  overdueDays: z.array(z.number().int().min(0))
});

export const governanceEscalationConfigSchema = z.object({
  enabled: z.boolean(),
  overdueDays: z.number().int().positive(),
  strategy: z.string().min(1).optional(),
  strategyConfig: z.record(z.string(), z.unknown()).default({}),
  fallbackTeamIds: idListSchema,
  fallbackUserIds: idListSchema
});

export const governanceWorkflowConfigSchema = z.object({
  approvals: governanceApprovalConfigSchema.optional(),
  reminders: governanceReminderConfigSchema.optional(),
  escalation: governanceEscalationConfigSchema.optional(),
  extensions: z.record(z.string(), z.unknown()).default({})
});

export type GovernanceApprovalConfig = z.infer<typeof governanceApprovalConfigSchema>;
export type GovernanceReminderConfig = z.infer<typeof governanceReminderConfigSchema>;
export type GovernanceEscalationConfig = z.infer<typeof governanceEscalationConfigSchema>;
export type GovernanceWorkflowConfig = z.infer<typeof governanceWorkflowConfigSchema>;

export const documentStatusExtensionSchema = z.object({
  statusesRequiringApprovals: z.array(z.string().min(1))
});

export type DocumentStatusExtension = z.infer<typeof documentStatusExtensionSchema>;

/** @deprecated Use the canonical camelCase workflow configuration. */
export const reminderCaseConfigSchema = z.object({
  approaching_days: z.array(z.number().int().min(0)),
  overdue_days: z.array(z.number().int().min(0)),
  escalation_enabled: z.boolean()
});

/** @deprecated Use the canonical camelCase workflow configuration. */
export type ReminderCaseConfig = z.infer<typeof reminderCaseConfigSchema>;

/** @deprecated Use the canonical camelCase workflow configuration. */
export const fieldDateReminderCaseConfigSchema = z.object({
  approaching_days: z.array(z.number().int().min(0)),
  overdue_days: z.array(z.number().int().min(0))
});

/** @deprecated Use the canonical camelCase workflow configuration. */
export type FieldDateReminderCaseConfig = z.infer<typeof fieldDateReminderCaseConfigSchema>;

/** @deprecated Per-value approval settings are no longer supported. */
export const documentStatusApprovalSchema = z.object({
  required: z.boolean(),
  requiredApprovals: z.number().int().positive().optional(),
  approverFieldId: z.string().min(1).optional(),
  fallbackUserIds: z.array(z.string().min(1)).default([]),
  fallbackTeamIds: z.array(z.string().min(1)).default([])
});

/** @deprecated Per-value approval settings are no longer supported. */
export const documentStatusApprovalConfigSchema = z.object({
  statuses: z.record(z.string(), documentStatusApprovalSchema)
});

/** @deprecated Per-value approval settings are no longer supported. */
export type DocumentStatusApproval = z.infer<typeof documentStatusApprovalSchema>;
/** @deprecated Per-value approval settings are no longer supported. */
export type DocumentStatusApprovalConfig = z.infer<typeof documentStatusApprovalConfigSchema>;
