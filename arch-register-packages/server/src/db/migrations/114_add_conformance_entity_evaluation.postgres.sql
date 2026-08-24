-- @creates conformance_entity_evaluation
CREATE TABLE IF NOT EXISTS conformance_entity_evaluation (
  workspace       UUID NOT NULL,
  check_id        UUID NOT NULL,
  entity_id       UUID NOT NULL,
  check_revision  INTEGER NOT NULL CHECK (check_revision > 0),
  run_id          UUID,
  evaluated_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace, check_id, entity_id),
  FOREIGN KEY (workspace) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (check_id) REFERENCES conformance_check(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id) REFERENCES catalog_record(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES conformance_evaluation_run(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS conformance_entity_evaluation_entity_idx
  ON conformance_entity_evaluation(workspace, entity_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS conformance_entity_evaluation_check_idx
  ON conformance_entity_evaluation(workspace, check_id, check_revision);
