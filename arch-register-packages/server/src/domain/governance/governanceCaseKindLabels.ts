/**
 * Human-readable presentation metadata for governance case kinds, shared by the reminder-config
 * and workflow-overview settings surfaces. Kept out of `governanceRegistry.ts`, since the
 * registry itself only carries domain-effect hooks, not presentation concerns.
 */
export const CASE_KIND_LABELS: Record<string, string> = {
  'entity.change-case': 'Entity change proposals',
  'entity.change-case.bulk': 'Bulk entity change proposals',
  'entity.deprecation': 'Entity deprecations',
  'relation.change-case': 'Relation change proposals',
  'document.status': 'Document status approvals',
  'assessment.response': 'Assessment responses',
  'field-date-reminder': 'Entity field date reminders'
};

export const CASE_KIND_DESCRIPTIONS: Record<string, string> = {
  'entity.change-case': 'Approval workflow for proposed changes to catalog entities.',
  'entity.change-case.bulk': 'Approval workflow for bulk proposed changes to catalog entities.',
  'entity.deprecation': 'Approval workflow for deprecating catalog entities.',
  'relation.change-case': 'Approval workflow for proposed changes to catalog relations.',
  'document.status':
    'Approver and quorum rules for document status fields, configured per document type.',
  'assessment.response': 'Governance workflow for submitted assessment responses.',
  'field-date-reminder':
    'Reminders for entity date fields flagged for reminders. Cadence is set per schema field, not workspace-wide.'
};
