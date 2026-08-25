import type { AuditEntityType, AuditOperation } from '@arch-register/api-types/auditContract';

export const OPERATION_LABELS: Record<AuditOperation, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted'
};

export const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  entity: 'entity',
  project: 'project',
  content_node: 'diagram',
  entity_schema: 'schema',
  workspace_field_group: 'shared fieldgroup',
  workspace_enum: 'enum',
  workspace: 'workspace',
  assessment: 'assessment',
  assessment_response: 'assessment response',
  project_milestone: 'milestone',
  relation_schema: 'relation schema',
  relation: 'relation',
  automation_note: 'automation note'
};
