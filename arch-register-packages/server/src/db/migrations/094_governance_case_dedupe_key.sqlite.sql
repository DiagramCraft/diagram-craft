ALTER TABLE governance_case ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX governance_case_open_dedupe_idx
  ON governance_case(workspace, case_kind, dedupe_key)
  WHERE status = 'open' AND dedupe_key IS NOT NULL;
