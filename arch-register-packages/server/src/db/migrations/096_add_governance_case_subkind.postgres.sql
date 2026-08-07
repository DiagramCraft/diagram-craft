ALTER TABLE governance_case
  ADD COLUMN IF NOT EXISTS case_subkind TEXT;

CREATE INDEX IF NOT EXISTS governance_case_subkind_idx
  ON governance_case(workspace, case_kind, case_subkind);
