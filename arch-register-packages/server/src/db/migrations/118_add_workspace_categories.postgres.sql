-- @creates workspace_category
CREATE TABLE IF NOT EXISTS workspace_category (
  id         UUID PRIMARY KEY,
  workspace  UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_category_workspace_name_idx
  ON workspace_category(workspace, LOWER(name));

ALTER TABLE entity_schema ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES workspace_category(id);
ALTER TABLE relation_schema ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES workspace_category(id);
ALTER TABLE workspace_enum ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES workspace_category(id);
ALTER TABLE workspace_field_group ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES workspace_category(id);

-- Backfill: one category row per distinct (workspace, case-insensitive trimmed name) found across
-- the four kinds' existing free-text `category` columns.
INSERT INTO workspace_category (id, workspace, name, created_at, updated_at)
SELECT
  gen_random_uuid(),
  workspace,
  MIN(TRIM(category)),
  NOW(),
  NOW()
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
SET category_id = wc.id
FROM workspace_category wc
WHERE wc.workspace = entity_schema.workspace
  AND LOWER(wc.name) = LOWER(TRIM(entity_schema.category))
  AND entity_schema.category IS NOT NULL AND TRIM(entity_schema.category) != '';

UPDATE relation_schema
SET category_id = wc.id
FROM workspace_category wc
WHERE wc.workspace = relation_schema.workspace
  AND LOWER(wc.name) = LOWER(TRIM(relation_schema.category))
  AND relation_schema.category IS NOT NULL AND TRIM(relation_schema.category) != '';

UPDATE workspace_enum
SET category_id = wc.id
FROM workspace_category wc
WHERE wc.workspace = workspace_enum.workspace
  AND LOWER(wc.name) = LOWER(TRIM(workspace_enum.category))
  AND workspace_enum.category IS NOT NULL AND TRIM(workspace_enum.category) != '';

UPDATE workspace_field_group
SET category_id = wc.id
FROM workspace_category wc
WHERE wc.workspace = workspace_field_group.workspace
  AND LOWER(wc.name) = LOWER(TRIM(workspace_field_group.category))
  AND workspace_field_group.category IS NOT NULL AND TRIM(workspace_field_group.category) != '';

-- Drop the old free-text columns from the live tables only; the *_version tables keep `category`
-- as a point-in-time name snapshot.
ALTER TABLE entity_schema DROP COLUMN IF EXISTS category;
ALTER TABLE relation_schema DROP COLUMN IF EXISTS category;
ALTER TABLE workspace_enum DROP COLUMN IF EXISTS category;
ALTER TABLE workspace_field_group DROP COLUMN IF EXISTS category;
