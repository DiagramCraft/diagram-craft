ALTER TABLE workspace_dashboard ADD COLUMN key TEXT;

-- Base slug: seeded application dashboards use the suffix of app_key, others a slug of the name.
-- Names that do not reduce to a valid slug fall back to 'dashboard'.
CREATE TEMP TABLE _dashboard_key_base AS
SELECT
  id, workspace, application_id, sort_order, application_order,
  CASE
    WHEN seeded_key IS NOT NULL THEN seeded_key
    WHEN slug <> '' AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-' THEN slug
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
        AND d.app_key LIKE substr(a.key, 1, instr(a.key, '-') - 1) || '-%'
        THEN substr(d.app_key, instr(a.key, '-') + 1)
      WHEN d.app_key IS NOT NULL AND a.key IS NOT NULL THEN 'overview'
      ELSE NULL
    END AS seeded_key,
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      lower(trim(d.name)),
      '(', ''), ')', ''), '!', ''), '?', ''), '''', ''), ',', ''), ':', '-'), ' ', '-'), '_', '-'), '/', '-'), '&', '-'), '.', '-'), '--', '-'), '--', '-'), '--', '-') AS slug
  FROM workspace_dashboard d
  LEFT JOIN workspace_application a ON a.id = d.application_id
);

UPDATE workspace_dashboard
SET key = (
  SELECT CASE WHEN r.rn = 1 THEN r.slug ELSE r.slug || '-' || r.rn END
  FROM (
    SELECT id, slug,
      row_number() OVER (
        PARTITION BY COALESCE(application_id, workspace), slug
        ORDER BY COALESCE(application_order, sort_order), sort_order, id
      ) AS rn
    FROM _dashboard_key_base
  ) r
  WHERE r.id = workspace_dashboard.id
);

DROP TABLE _dashboard_key_base;

CREATE UNIQUE INDEX workspace_dashboard_app_scope_key_idx
  ON workspace_dashboard (application_id, key)
  WHERE application_id IS NOT NULL;

CREATE UNIQUE INDEX workspace_dashboard_workspace_scope_key_idx
  ON workspace_dashboard (workspace, key)
  WHERE application_id IS NULL;
