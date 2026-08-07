import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';
import { fieldDateReminderCaseConfigSchema } from './governanceCaseConfigSchemas';

const fieldDateReminderConfigSchema = z.object({
  schema_id: z.string(),
  field_id: z.string(),
  case_subkind: z.string(),
  enabled: z.boolean(),
  config: fieldDateReminderCaseConfigSchema
});

const fieldDateReminderConfigUpdateSchema = z.object({
  enabled: z.boolean(),
  approaching_days: z.array(z.number().int().min(0)),
  overdue_days: z.array(z.number().int().min(0))
});

export const governanceFieldDateReminderConfigContract = oc.tag('Governance').router({
  governanceFieldDateReminderConfig: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/governance/field-date-reminder-config/{id}',
        inputStructure: 'detailed',
        summary: 'List field-date reminder configuration',
        tags: ['Governance']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(fieldDateReminderConfigSchema)),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/governance/field-date-reminder-config/{id}/{fieldId}',
        inputStructure: 'detailed',
        summary: 'Update field-date reminder configuration',
        tags: ['Governance']
      })
      .input(
        z.object({
          params: wsAndId.extend({ fieldId: z.string().min(1) }),
          body: fieldDateReminderConfigUpdateSchema
        })
      )
      .output(fieldDateReminderConfigSchema)
  }
});

export type GovernanceFieldDateReminderConfig = z.infer<typeof fieldDateReminderConfigSchema>;
export type GovernanceFieldDateReminderConfigUpdate = z.infer<
  typeof fieldDateReminderConfigUpdateSchema
>;
