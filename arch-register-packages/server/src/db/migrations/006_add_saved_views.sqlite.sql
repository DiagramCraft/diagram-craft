CREATE TABLE saved_view (
    id TEXT PRIMARY KEY,
    workspace TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    view_mode TEXT NOT NULL,
    filters TEXT NOT NULL DEFAULT '{}',
    config TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX saved_view_workspace_idx ON saved_view(workspace);
