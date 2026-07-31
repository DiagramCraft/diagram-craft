ALTER TABLE entity_schema RENAME COLUMN shared_field_group_ids TO shared_field_group_links;
ALTER TABLE entity_schema_version RENAME COLUMN shared_field_group_ids TO shared_field_group_links;

UPDATE entity_schema
SET shared_field_group_links = COALESCE(
  (SELECT json_group_array(json_object('groupId', value)) FROM json_each(entity_schema.shared_field_group_links)),
  '[]'
);

UPDATE entity_schema_version
SET shared_field_group_links = COALESCE(
  (SELECT json_group_array(json_object('groupId', value)) FROM json_each(entity_schema_version.shared_field_group_links)),
  '[]'
);
