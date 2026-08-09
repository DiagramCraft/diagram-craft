ALTER TABLE audit_log ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX audit_log_dedupe_idx
  ON audit_log(workspace, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
