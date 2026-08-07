-- Move document status approval rules out of document JSON and into the generalized
-- workspace_governance_case_config store. Keep isStatus in the document field definition.
INSERT INTO workspace_governance_case_config (
  id, workspace, case_kind, case_subkind, enabled, config, updated_at, updated_by
)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
    lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
    lower(hex(randomblob(6))),
  document_type.workspace,
  'document.status',
  document_type.id || ':' || json_extract(status_field.value, '$.id'),
  1,
  json_object(
    'statuses',
    COALESCE(
      (
        SELECT json_group_object(
          json_extract(option.value, '$.value'),
          json_extract(option.value, '$.approval')
        )
        FROM json_each(json_extract(status_field.value, '$.enumOptions')) option
        WHERE json_type(option.value, '$.approval') IS NOT NULL
      ),
      '{}'
    )
  ),
  document_type.updated_at,
  NULL
FROM document_type
JOIN json_each(document_type.fields) status_field
WHERE json_extract(status_field.value, '$.isStatus') = 1
  AND json_type(status_field.value, '$.enumOptions') = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_governance_case_config existing
    WHERE existing.workspace = document_type.workspace
      AND existing.case_kind = 'document.status'
      AND existing.case_subkind = document_type.id || ':' || json_extract(status_field.value, '$.id')
  );

UPDATE document_type
SET fields = (
  SELECT json_group_array(
    CASE
      WHEN json_type(field.value, '$.enumOptions') = 'array' THEN
        json_set(
          field.value,
          '$.enumOptions',
          json(
            COALESCE(
              (
                SELECT json_group_array(json_remove(option.value, '$.approval'))
                FROM json_each(json_extract(field.value, '$.enumOptions')) option
              ),
              '[]'
            )
          )
        )
      ELSE field.value
    END
  )
  FROM json_each(document_type.fields) field
);

UPDATE document_field
SET enum_options = (
  SELECT json_group_array(json_remove(option.value, '$.approval'))
  FROM json_each(document_field.enum_options) option
);

UPDATE document_type_version
SET fields = (
  SELECT json_group_array(
    CASE
      WHEN json_type(field.value, '$.enumOptions') = 'array' THEN
        json_set(
          field.value,
          '$.enumOptions',
          json(
            COALESCE(
              (
                SELECT json_group_array(json_remove(option.value, '$.approval'))
                FROM json_each(json_extract(field.value, '$.enumOptions')) option
              ),
              '[]'
            )
          )
        )
      ELSE field.value
    END
  )
  FROM json_each(document_type_version.fields) field
);
