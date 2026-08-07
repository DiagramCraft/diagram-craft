import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const governanceWorkflowCapabilitiesSchema = z.object({
  reminders: z.boolean().describe('Whether this case kind supports scheduled deadline reminders'),
  escalation: z.boolean().describe('Whether this case kind supports overdue escalation'),
  approvalQuorum: z
    .boolean()
    .describe('Whether this case kind has configurable approver/quorum rules')
});

const governanceWorkflowApprovalSummarySchema = z.object({
  documentTypesConfigured: z
    .number()
    .int()
    .min(0)
    .describe('Number of document types with at least one workflow-enabled status field'),
  fieldsConfigured: z
    .number()
    .int()
    .min(0)
    .describe('Number of status fields, across all document types, with approval required')
});

const governanceWorkflowConfiguredElsewhereSchema = z.object({
  settings_section_id: z.string().describe('Workspace settings section id to link to'),
  settings_section_label: z.string().describe('Human-readable label of that settings section')
});

const governanceWorkflowOverviewSchema = z.object({
  case_kind: z.string().describe('Governance case kind'),
  label: z.string().describe('Human-readable label for the case kind'),
  description: z.string().describe('Short human-readable description of the workflow'),
  capabilities: governanceWorkflowCapabilitiesSchema,
  approval_summary: governanceWorkflowApprovalSummarySchema
    .optional()
    .describe('Present only when capabilities.approvalQuorum is true'),
  configured_elsewhere: governanceWorkflowConfiguredElsewhereSchema
    .optional()
    .describe(
      'Present when this case kind has configuration that is not surfaced on this screen at ' +
        'all (e.g. per-schema-field settings), so the card can link out instead of implying ' +
        'nothing is configurable'
    )
});

export const governanceWorkflowOverviewContract = oc.tag('Governance').router({
  governanceWorkflowOverview: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/governance/workflows',
        inputStructure: 'detailed',
        summary: 'List governance workflow overview',
        description:
          'Lists every governance case kind with a summary of which workflow settings it supports, for the unified workflow admin screen.',
        tags: ['Governance']
      })
      .input(z.object({ params: ws }))
      .output(z.array(governanceWorkflowOverviewSchema))
  }
});

export type GovernanceWorkflowOverview = z.infer<typeof governanceWorkflowOverviewSchema>;
