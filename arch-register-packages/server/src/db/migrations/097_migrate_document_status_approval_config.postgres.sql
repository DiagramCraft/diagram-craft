-- Seed harmonized document status workflow configuration in the generalized store.
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
    'approvals', jsonb_build_object(
      'requiredApprovals', 1,
      'fallbackUserIds', '[]'::jsonb,
      'fallbackTeamIds', '[]'::jsonb
    ),
    'extensions', jsonb_build_object(
      'document.status', jsonb_build_object(
        'statusesRequiringApprovals', COALESCE(
          (
            SELECT jsonb_agg(option->>'value')
            FROM jsonb_array_elements(COALESCE(status_field->'enumOptions', '[]'::jsonb)) option
            WHERE option ? 'approval'
          ),
          '[]'::jsonb
        )
      )
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
