import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const governanceReminderConfigSchema = z.object({
  case_kind: z.string().describe('Governance case kind this config applies to'),
  case_kind_label: z.string().describe('Human-readable label for the case kind'),
  enabled: z.boolean().describe('Whether scheduled reminders are enabled for this case kind'),
  approaching_days: z
    .array(z.number().int().min(0))
    .describe('Days before due_at at which an approaching-deadline reminder is sent'),
  overdue_days: z
    .array(z.number().int().min(0))
    .describe('Days past due_at at which an overdue reminder is sent'),
  escalation_supported: z
    .boolean()
    .describe('Whether this case kind has a built-in escalation threshold at all'),
  escalation_enabled: z
    .boolean()
    .describe(
      'Whether overdue cases of this kind escalate to the code-defined escalation target. Only meaningful when escalation_supported is true.'
    ),
  is_default: z
    .boolean()
    .describe('True if this reflects the case kind’s code default rather than a workspace override')
});

const governanceReminderConfigUpdateSchema = z.object({
  enabled: z.boolean(),
  approaching_days: z.array(z.number().int().min(0)),
  overdue_days: z.array(z.number().int().min(0)),
  escalation_enabled: z.boolean()
});

export const governanceReminderConfigContract = oc.tag('Governance').router({
  governanceReminderConfig: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/governance/reminder-config',
        inputStructure: 'detailed',
        summary: 'List governance reminder configuration',
        description:
          'Lists the scheduled deadline reminder configuration for each governance case kind that supports it, merging any workspace override with the case kind’s code default.',
        tags: ['Governance']
      })
      .input(z.object({ params: ws }))
      .output(z.array(governanceReminderConfigSchema)),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/governance/reminder-config/{caseKind}',
        inputStructure: 'detailed',
        summary: 'Update governance reminder configuration',
        description:
          'Sets a workspace-specific override of the reminder day thresholds for a governance case kind.',
        tags: ['Governance']
      })
      .input(
        z.object({
          params: ws.extend({ caseKind: z.string() }),
          body: governanceReminderConfigUpdateSchema
        })
      )
      .output(governanceReminderConfigSchema)
  }
});

export type GovernanceReminderConfig = z.infer<typeof governanceReminderConfigSchema>;
export type UpdateGovernanceReminderConfigRequest = z.infer<
  typeof governanceReminderConfigUpdateSchema
>;
