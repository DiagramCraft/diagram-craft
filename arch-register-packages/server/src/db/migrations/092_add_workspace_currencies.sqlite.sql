-- @creates workspace_currency
CREATE TABLE IF NOT EXISTS workspace_currency (
  workspace    TEXT NOT NULL,
  code         TEXT NOT NULL,
  label        TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_default   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace, code),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO workspace_currency (workspace, code, label, sort_order, is_default)
SELECT id, 'USD', 'US Dollar', 0, 1 FROM workspace
UNION ALL SELECT id, 'EUR', 'Euro', 1, 0 FROM workspace
UNION ALL SELECT id, 'GBP', 'Pound Sterling', 2, 0 FROM workspace
UNION ALL SELECT id, 'SEK', 'Swedish Krona', 3, 0 FROM workspace
UNION ALL SELECT id, 'NOK', 'Norwegian Krone', 4, 0 FROM workspace
UNION ALL SELECT id, 'DKK', 'Danish Krone', 5, 0 FROM workspace;
