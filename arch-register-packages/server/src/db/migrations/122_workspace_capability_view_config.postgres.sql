-- Capability-specific presentation config (e.g. strategy-model view config, #3203).
ALTER TABLE workspace_capability_configuration
  ADD COLUMN view_config JSONB;
