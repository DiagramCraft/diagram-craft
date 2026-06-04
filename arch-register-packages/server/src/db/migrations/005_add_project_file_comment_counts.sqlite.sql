ALTER TABLE project_file ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE project_file ADD COLUMN unresolved_comment_count INTEGER NOT NULL DEFAULT 0;
