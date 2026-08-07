ALTER TABLE governance_case ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS governance_case_open_dedupe_idx
  ON governance_case(workspace, case_kind, dedupe_key)
  WHERE status = 'open' AND dedupe_key IS NOT NULL;
