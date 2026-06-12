-- @creates diagram_entity_ref
CREATE TABLE diagram_entity_ref (
  workspace  TEXT NOT NULL,
  file_id    TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  PRIMARY KEY (workspace, file_id, entity_id),
  FOREIGN KEY (file_id) REFERENCES content_node(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace, entity_id) REFERENCES entity(workspace, id) ON DELETE CASCADE
);

CREATE INDEX diagram_entity_ref_entity_idx ON diagram_entity_ref(workspace, entity_id);
