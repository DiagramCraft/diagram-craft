ALTER TABLE entity_schema RENAME COLUMN shared_field_group_ids TO shared_field_group_links;
ALTER TABLE entity_schema_version RENAME COLUMN shared_field_group_ids TO shared_field_group_links;

UPDATE entity_schema
SET shared_field_group_links = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('groupId', value)), '[]'::jsonb)
  FROM jsonb_array_elements_text(shared_field_group_links) AS value
);

UPDATE entity_schema_version
SET shared_field_group_links = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('groupId', value)), '[]'::jsonb)
  FROM jsonb_array_elements_text(shared_field_group_links) AS value
);
