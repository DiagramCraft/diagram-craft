ALTER TABLE workspace_dashboard ADD COLUMN IF NOT EXISTS key TEXT;

-- Base slug: seeded application dashboards use the suffix of app_key, others a slug of the name.
-- Names that do not reduce to a valid slug fall back to 'dashboard'.
WITH base AS (
  SELECT
    id, workspace, application_id, sort_order, application_order,
    CASE
      WHEN seeded_key IS NOT NULL THEN seeded_key
      WHEN slug <> '' AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN slug
      ELSE 'dashboard'
    END AS slug
  FROM (
    SELECT
      d.id, d.workspace, d.application_id, d.sort_order, d.application_order,
      CASE
        WHEN d.app_key = a.key THEN 'overview'
        WHEN d.app_key IS NOT NULL AND a.key IS NOT NULL AND d.app_key LIKE a.key || '-%'
          THEN substr(d.app_key, length(a.key) + 2)
        WHEN d.app_key IS NOT NULL AND a.key LIKE '%-%'
          AND d.app_key LIKE split_part(a.key, '-', 1) || '-%'
          THEN substr(d.app_key, length(split_part(a.key, '-', 1)) + 2)
        WHEN d.app_key IS NOT NULL AND a.key IS NOT NULL THEN 'overview'
        ELSE NULL
      END AS seeded_key,
      trim(both '-' from regexp_replace(lower(trim(d.name)), '[^a-z0-9]+', '-', 'g')) AS slug
    FROM workspace_dashboard d
    LEFT JOIN workspace_application a ON a.id = d.application_id
  ) s
),
ranked AS (
  SELECT id, slug,
    row_number() OVER (
      PARTITION BY COALESCE(application_id, workspace), slug
      ORDER BY COALESCE(application_order, sort_order), sort_order, id
    ) AS rn
  FROM base
)
UPDATE workspace_dashboard d
SET key = CASE WHEN r.rn = 1 THEN r.slug ELSE r.slug || '-' || r.rn END
FROM ranked r
WHERE r.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_dashboard_app_scope_key_idx
  ON workspace_dashboard (application_id, key)
  WHERE application_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_dashboard_workspace_scope_key_idx
  ON workspace_dashboard (workspace, key)
  WHERE application_id IS NULL;
