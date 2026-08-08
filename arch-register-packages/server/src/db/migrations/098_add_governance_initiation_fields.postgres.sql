ALTER TABLE governance_case
  ADD COLUMN initiation_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
