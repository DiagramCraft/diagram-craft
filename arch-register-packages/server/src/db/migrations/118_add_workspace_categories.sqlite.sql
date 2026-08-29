-- @creates workspace_category
CREATE TABLE workspace_category (
  id         TEXT PRIMARY KEY,
  workspace  TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX workspace_category_workspace_name_idx
  ON workspace_category(workspace, name COLLATE NOCASE);

ALTER TABLE entity_schema ADD COLUMN category_id TEXT REFERENCES workspace_category(id);
ALTER TABLE relation_schema ADD COLUMN category_id TEXT REFERENCES workspace_category(id);
ALTER TABLE workspace_enum ADD COLUMN category_id TEXT REFERENCES workspace_category(id);
ALTER TABLE workspace_field_group ADD COLUMN category_id TEXT REFERENCES workspace_category(id);

-- Backfill: one category row per distinct (workspace, case-insensitive trimmed name) found across
-- the four kinds' existing free-text `category` columns.
INSERT INTO workspace_category (id, workspace, name, created_at, updated_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
    lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
    lower(hex(randomblob(6))),
  workspace,
  MIN(TRIM(category)),
  datetime('now'),
  datetime('now')
FROM (
  SELECT workspace, category FROM entity_schema WHERE category IS NOT NULL AND TRIM(category) != ''
  UNION ALL
  SELECT workspace, category FROM relation_schema WHERE category IS NOT NULL AND TRIM(category) != ''
  UNION ALL
  SELECT workspace, category FROM workspace_enum WHERE category IS NOT NULL AND TRIM(category) != ''
  UNION ALL
  SELECT workspace, category FROM workspace_field_group WHERE category IS NOT NULL AND TRIM(category) != ''
) all_categories
GROUP BY workspace, LOWER(TRIM(category));

UPDATE entity_schema
SET category_id = (
  SELECT wc.id FROM workspace_category wc
  WHERE wc.workspace = entity_schema.workspace AND LOWER(wc.name) = LOWER(TRIM(entity_schema.category))
)
WHERE category IS NOT NULL AND TRIM(category) != '';

UPDATE relation_schema
SET category_id = (
  SELECT wc.id FROM workspace_category wc
  WHERE wc.workspace = relation_schema.workspace AND LOWER(wc.name) = LOWER(TRIM(relation_schema.category))
)
WHERE category IS NOT NULL AND TRIM(category) != '';

UPDATE workspace_enum
SET category_id = (
  SELECT wc.id FROM workspace_category wc
  WHERE wc.workspace = workspace_enum.workspace AND LOWER(wc.name) = LOWER(TRIM(workspace_enum.category))
)
WHERE category IS NOT NULL AND TRIM(category) != '';

UPDATE workspace_field_group
SET category_id = (
  SELECT wc.id FROM workspace_category wc
  WHERE wc.workspace = workspace_field_group.workspace AND LOWER(wc.name) = LOWER(TRIM(workspace_field_group.category))
)
WHERE category IS NOT NULL AND TRIM(category) != '';

-- Drop the old free-text columns from the live tables only; the *_version tables keep `category`
-- as a point-in-time name snapshot.
ALTER TABLE entity_schema DROP COLUMN category;
ALTER TABLE relation_schema DROP COLUMN category;
ALTER TABLE workspace_enum DROP COLUMN category;
ALTER TABLE workspace_field_group DROP COLUMN category;
