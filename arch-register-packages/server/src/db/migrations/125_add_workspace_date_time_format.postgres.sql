ALTER TABLE workspace
ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'iso'
  CHECK (date_format IN ('iso', 'month-name', 'md-slash', 'dmy-slash', 'dmy-dot'));

ALTER TABLE workspace
ADD COLUMN IF NOT EXISTS time_format TEXT NOT NULL DEFAULT '24h'
  CHECK (time_format IN ('12h', '24h'));
