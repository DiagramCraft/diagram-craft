-- @creates workspace_currency
CREATE TABLE IF NOT EXISTS workspace_currency (
  workspace    UUID NOT NULL,
  code         TEXT NOT NULL,
  label        TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (workspace, code),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

INSERT INTO workspace_currency (workspace, code, label, sort_order, is_default)
SELECT id, 'USD', 'US Dollar', 0, TRUE FROM workspace
UNION ALL SELECT id, 'EUR', 'Euro', 1, FALSE FROM workspace
UNION ALL SELECT id, 'GBP', 'Pound Sterling', 2, FALSE FROM workspace
UNION ALL SELECT id, 'SEK', 'Swedish Krona', 3, FALSE FROM workspace
UNION ALL SELECT id, 'NOK', 'Norwegian Krone', 4, FALSE FROM workspace
UNION ALL SELECT id, 'DKK', 'Danish Krone', 5, FALSE FROM workspace
ON CONFLICT (workspace, code) DO NOTHING;
