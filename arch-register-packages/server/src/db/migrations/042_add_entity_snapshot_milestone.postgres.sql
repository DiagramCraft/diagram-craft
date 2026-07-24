ALTER TABLE entity_snapshot ADD COLUMN milestone_id UUID;

ALTER TABLE entity_snapshot
  ADD CONSTRAINT entity_snapshot_milestone_fk
  FOREIGN KEY (milestone_id) REFERENCES project_milestone(id) ON DELETE SET NULL;

ALTER TABLE entity_snapshot
  ADD CONSTRAINT entity_snapshot_milestone_target_date_excl
  CHECK (NOT (milestone_id IS NOT NULL AND target_date IS NOT NULL));

CREATE INDEX IF NOT EXISTS entity_snapshot_milestone_idx ON entity_snapshot(milestone_id) WHERE milestone_id IS NOT NULL;
