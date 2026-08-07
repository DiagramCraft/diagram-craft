-- Move document status approval rules out of document JSON and into the generalized
-- workspace_governance_case_config store. Keep isStatus in the document field definition.
INSERT INTO workspace_governance_case_config (
  id, workspace, case_kind, case_subkind, enabled, config, updated_at, updated_by
)
SELECT
  gen_random_uuid(),
  document_type.workspace,
  'document.status',
  document_type.id::text || ':' || (status_field->>'id'),
  TRUE,
  jsonb_build_object(
    'statuses',
    COALESCE(
      (
        SELECT jsonb_object_agg(option->>'value', option->'approval')
        FROM jsonb_array_elements(COALESCE(status_field->'enumOptions', '[]'::jsonb)) option
        WHERE option ? 'approval'
      ),
      '{}'::jsonb
    )
  ),
  document_type.updated_at,
  NULL
FROM document_type
CROSS JOIN LATERAL jsonb_array_elements(document_type.fields) status_field
WHERE status_field->>'isStatus' = 'true'
  AND jsonb_typeof(status_field->'enumOptions') = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_governance_case_config existing
    WHERE existing.workspace = document_type.workspace
      AND existing.case_kind = 'document.status'
      AND existing.case_subkind = document_type.id::text || ':' || (status_field->>'id')
  );

UPDATE document_type
SET fields = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(field->'enumOptions') = 'array' THEN
          jsonb_set(
            field,
            '{enumOptions}',
            COALESCE(
              (
                SELECT jsonb_agg(option - 'approval')
                FROM jsonb_array_elements(field->'enumOptions') option
              ),
              '[]'::jsonb
            )
          )
        ELSE field
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(document_type.fields) field
);

UPDATE document_field
SET enum_options = (
  SELECT COALESCE(jsonb_agg(option - 'approval'), '[]'::jsonb)
  FROM jsonb_array_elements(document_field.enum_options) option
);

UPDATE document_type_version
SET fields = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(field->'enumOptions') = 'array' THEN
          jsonb_set(
            field,
            '{enumOptions}',
            COALESCE(
              (
                SELECT jsonb_agg(option - 'approval')
                FROM jsonb_array_elements(field->'enumOptions') option
              ),
              '[]'::jsonb
            )
          )
        ELSE field
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(document_type_version.fields) field
);
