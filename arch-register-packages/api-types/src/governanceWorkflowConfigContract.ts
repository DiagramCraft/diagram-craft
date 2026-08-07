import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import { governanceWorkflowConfigSchema } from './governanceCaseConfigSchemas';

const governanceWorkflowCaseKindSchema = z.object({
  case_kind: z.string().min(1),
  label: z.string(),
  description: z.string(),
  supportsSubkind: z.boolean(),
  supportsApprovals: z.boolean(),
  supportsReminders: z.boolean(),
  supportsEscalation: z.boolean()
});

const governanceWorkflowConfigRowSchema = z.object({
  id: z.string(),
  case_kind: z.string().min(1),
  case_kind_label: z.string(),
  case_kind_description: z.string(),
  case_subkind: z.string().nullable(),
  case_subkind_label: z.string().nullable(),
  enabled: z.boolean(),
  config: governanceWorkflowConfigSchema,
  updated_at: z.string(),
  updated_by: z.string().nullable()
});

const governanceWorkflowConfigUpsertSchema = z.object({
  case_kind: z.string().min(1),
  case_subkind: z.string().min(1).nullable(),
  enabled: z.boolean().optional(),
  config: governanceWorkflowConfigSchema
});

const governanceWorkflowConfigResetSchema = z.object({
  case_kind: z.string().min(1),
  case_subkind: z.string().min(1).nullable()
});

export const governanceWorkflowConfigContract = oc.tag('Governance').router({
  governanceWorkflowConfig: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/governance/workflow-config',
        inputStructure: 'detailed',
        summary: 'List centralized governance workflow configuration',
        tags: ['Governance']
      })
      .input(z.object({ params: ws }))
      .output(
        z.object({
          case_kinds: z.array(governanceWorkflowCaseKindSchema),
          configs: z.array(governanceWorkflowConfigRowSchema)
        })
      ),
    upsert: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/governance/workflow-config',
        inputStructure: 'detailed',
        summary: 'Save centralized governance workflow configuration',
        tags: ['Governance']
      })
      .input(z.object({ params: ws, body: governanceWorkflowConfigUpsertSchema }))
      .output(governanceWorkflowConfigRowSchema),
    reset: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/governance/workflow-config',
        inputStructure: 'detailed',
        summary: 'Reset centralized governance workflow configuration',
        tags: ['Governance']
      })
      .input(z.object({ params: ws, body: governanceWorkflowConfigResetSchema }))
      .output(z.object({ reset: z.boolean() }))
  }
});

export type GovernanceWorkflowCaseKind = z.infer<typeof governanceWorkflowCaseKindSchema>;
export type GovernanceWorkflowConfigRow = z.infer<typeof governanceWorkflowConfigRowSchema>;
export type GovernanceWorkflowConfigUpsert = z.infer<typeof governanceWorkflowConfigUpsertSchema>;
