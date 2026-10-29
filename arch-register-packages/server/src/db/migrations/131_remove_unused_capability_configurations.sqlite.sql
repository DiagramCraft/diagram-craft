-- Bindings are only kept for capabilities with non-dashboard consumers (api-specification);
-- dashboards no longer read them.
DELETE FROM workspace_capability_configuration
WHERE type <> 'api-specification';
