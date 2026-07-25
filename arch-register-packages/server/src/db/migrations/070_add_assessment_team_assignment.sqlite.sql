ALTER TABLE assessment
  ADD COLUMN assigned_team_ids TEXT NOT NULL DEFAULT '[]';

ALTER TABLE assessment
  ADD COLUMN due_at TEXT;
