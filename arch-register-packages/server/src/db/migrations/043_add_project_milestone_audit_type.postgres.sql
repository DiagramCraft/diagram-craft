ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('workspace', 'entity_schema', 'entity', 'project', 'content_node', 'assessment', 'assessment_response', 'project_milestone'));
