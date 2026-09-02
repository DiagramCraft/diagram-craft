import { compileEntityViewPermissionScope } from './db/entityPermissionScope';
import {
  addParam,
  RELATION_SCOPE_CTE,
  SCOPE_CTE,
  type EntityQuerySqlRenderState
} from './entityQueryIRSqlContext';
import { UnsupportedEntityQueryIRError } from './entityQueryIRErrors';

const conformanceApplicableCheckClause = (
  checkAlias: string,
  entityAlias: string,
  state: EntityQuerySqlRenderState
): string => {
  const type = state.dialectAdapter.jsonPathText(`${checkAlias}.definition`, ['type']);
  const schemaId = state.dialectAdapter.jsonPathText(`${checkAlias}.definition`, ['schemaId']);
  const querySchemaId = state.dialectAdapter.jsonPathText(`${checkAlias}.definition`, [
    'query',
    'schemaId'
  ]);
  const entitySchemaId = state.dialectAdapter.textCast(`${entityAlias}.schema_id`);
  return `(
    ((${type} = 'scheduled_validation' OR ${type} = 'ai_prompt') AND ${schemaId} = ${entitySchemaId})
    OR (${type} = 'query_policy' AND (${querySchemaId} IS NULL OR ${querySchemaId} = ${entitySchemaId}))
  )`;
};

const conformanceEffectiveStatus = (
  violationAlias: string,
  state: EntityQuerySqlRenderState
): string => {
  const now = state.dialectAdapter.nowTimestamp;
  const expiresAt = state.dialectAdapter.dateTime('ce.expires_at');
  return `CASE
    WHEN ${violationAlias}.status != 'resolved'
      AND EXISTS (
        SELECT 1
        FROM conformance_exemption ce
        WHERE ce.violation_id = ${violationAlias}.id
          AND ce.revoked_at IS NULL
          AND (ce.expires_at IS NULL OR ${expiresAt} > ${now})
      )
    THEN 'exempt'
    ELSE ${violationAlias}.status
  END`;
};

const buildConformanceStatusCte = (state: EntityQuerySqlRenderState): string => {
  const enabled = state.dialectAdapter.trueLiteral;
  const applicable = conformanceApplicableCheckClause('c', 'e', state);
  const effectiveStatus = conformanceEffectiveStatus('v', state);
  const staleThreshold = state.dialectAdapter.conformanceStaleThreshold('ea.oldest_evaluated_at');
  const updatedAfterEvaluation = state.dialectAdapter.conformanceUpdatedAfterEvaluation(
    'e.updated_at',
    'ea.last_evaluated_at'
  );
  const falseValue = state.dialectAdapter.falseLiteral;
  const trueValue = state.dialectAdapter.trueLiteral;
  // Scope every aggregate CTE to the query's own workspace up front, rather than aggregating
  // across every workspace in the deployment and relying on the outer join to discard the rest.
  // A fresh addParam() call per occurrence — not one placeholder string reused — because SQLite's
  // `?` placeholders are positional: each occurrence must consume its own entry in params, unlike
  // Postgres's numbered `$N` placeholders where the same param can be referenced repeatedly.
  const violationWorkspaceParam = addParam(state, state.workspace);
  const evaluationWorkspaceParam = addParam(state, state.workspace);
  const statusWorkspaceParam = addParam(state, state.workspace);

  return `
    conformance_violation_aggregate AS (
      SELECT v.workspace, v.entity_id,
        SUM(CASE WHEN ${effectiveStatus} = 'active' THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN ${effectiveStatus} = 'acknowledged' THEN 1 ELSE 0 END) AS acknowledged_count,
        SUM(CASE WHEN ${effectiveStatus} = 'exempt' THEN 1 ELSE 0 END) AS exempt_count
      FROM conformance_violation v
      JOIN conformance_check c
        ON c.id = v.check_id
       AND c.workspace = v.workspace
       AND c.enabled = ${enabled}
      JOIN catalog_record e
        ON e.id = v.entity_id
       AND e.workspace = v.workspace
       AND e.kind = 'entity'
      WHERE v.workspace = ${violationWorkspaceParam}
        AND ${conformanceApplicableCheckClause('c', 'e', state)}
      GROUP BY v.workspace, v.entity_id
    ),
    conformance_evaluation_aggregate AS (
      SELECT e.workspace, e.id AS entity_id,
        COUNT(DISTINCT c.id) AS applicable_check_count,
        COUNT(DISTINCT CASE WHEN ee.entity_id IS NOT NULL THEN c.id END) AS covered_check_count,
        MAX(ee.evaluated_at) AS last_evaluated_at,
        MIN(ee.evaluated_at) AS oldest_evaluated_at
      FROM catalog_record e
      LEFT JOIN conformance_check c
        ON c.workspace = e.workspace
       AND c.enabled = ${enabled}
       AND ${applicable}
      LEFT JOIN conformance_entity_evaluation ee
        ON ee.workspace = e.workspace
       AND ee.entity_id = e.id
       AND ee.check_id = c.id
       AND ee.check_revision = c.revision
      WHERE e.workspace = ${evaluationWorkspaceParam}
        AND e.kind = 'entity'
        AND e.deleted_at IS NULL
      GROUP BY e.workspace, e.id
    ),
    conformance_entity_status AS (
      SELECT e.workspace, e.id AS entity_id,
        CASE
          WHEN COALESCE(va.active_count, 0) > 0 THEN 'violating'
          WHEN COALESCE(va.acknowledged_count, 0) > 0 THEN 'acknowledged'
          WHEN COALESCE(va.exempt_count, 0) > 0 THEN 'exempt'
          WHEN COALESCE(ea.covered_check_count, 0) = 0 THEN 'not_evaluated'
          ELSE 'conformant'
        END AS conformance_status,
        ea.last_evaluated_at AS conformance_evaluated_at,
        CASE
          WHEN COALESCE(ea.applicable_check_count, 0) = 0 THEN ${falseValue}
          WHEN COALESCE(ea.covered_check_count, 0) < ea.applicable_check_count THEN ${trueValue}
          WHEN ${staleThreshold} THEN ${trueValue}
          WHEN ea.last_evaluated_at IS NOT NULL AND ${updatedAfterEvaluation} THEN ${trueValue}
          ELSE ${falseValue}
        END AS conformance_stale
      FROM catalog_record e
      LEFT JOIN conformance_violation_aggregate va
        ON va.workspace = e.workspace
       AND va.entity_id = e.id
      LEFT JOIN conformance_evaluation_aggregate ea
        ON ea.workspace = e.workspace
       AND ea.entity_id = e.id
      WHERE e.workspace = ${statusWorkspaceParam}
        AND e.kind = 'entity'
        AND e.deleted_at IS NULL
    )`;
};

const relationEndpointSchemaClause = (
  alias: string,
  schemaIds: readonly string[],
  state: EntityQuerySqlRenderState
): string => {
  if (schemaIds.length === 0) return '1=0';
  return `${alias}.schema_id IN (${schemaIds.map(schemaId => addParam(state, schemaId)).join(', ')})`;
};

const relationVisibilityClause = (
  relationAlias: string,
  inEndpointAlias: string,
  outEndpointAlias: string,
  state: EntityQuerySqlRenderState
): string => {
  const policy = state.relationVisibility;
  if (policy == null) return '1=1';

  // Endpoint availability is a prerequisite for every authenticated visibility branch. Keep it
  // outside the owner/endpoint OR so an owner override cannot surface a relation whose endpoint
  // schema has disappeared from the catalog.
  const endpointAvailability = `(${relationEndpointSchemaClause(
    inEndpointAlias,
    policy.entitySchemaIds,
    state
  )} AND ${relationEndpointSchemaClause(outEndpointAlias, policy.entitySchemaIds, state)})`;

  const ownerClause =
    policy.ownerIds.length === 0
      ? '1=0'
      : `${relationAlias}.owner IN (${policy.ownerIds.map(ownerId => addParam(state, ownerId)).join(', ')})`;
  const endpointClauses = policy.allOwners
    ? []
    : policy.endpointScopes.map(scope => {
        const relationSchemaParam = addParam(state, scope.relationSchemaId);
        const inClause = relationEndpointSchemaClause(
          inEndpointAlias,
          scope.inEntitySchemaIds,
          state
        );
        const outClause = relationEndpointSchemaClause(
          outEndpointAlias,
          scope.outEntitySchemaIds,
          state
        );
        return `(${relationAlias}.schema_id = ${relationSchemaParam} AND (${inClause} OR ${outClause}))`;
      });

  const accessClause = policy.allOwners
    ? '1=1'
    : `(${ownerClause}${endpointClauses.length > 0 ? ` OR ${endpointClauses.join(' OR ')}` : ''})`;

  return `(${endpointAvailability} AND ${accessClause})`;
};

const relationSourceSchemaIds = (state: EntityQuerySqlRenderState): readonly string[] => [
  ...new Set(state.relationSourceConstraints.map(constraint => constraint.relationSchemaId))
];

const relationSourceSchemaClause = (alias: string, state: EntityQuerySqlRenderState): string => {
  const schemaIds = relationSourceSchemaIds(state);
  if (schemaIds.length === 0) return '1=1';
  return `${alias}.schema_id IN (${schemaIds.map(schemaId => addParam(state, schemaId)).join(', ')})`;
};

const relationRootTemporalCandidateClause = (
  alias: string,
  state: EntityQuerySqlRenderState
): string | null => {
  const candidate = state.relationRootTemporalCandidate;
  if (!candidate) return null;

  const branches: string[] = [];
  if (candidate.relationSchemaIds.length > 0) {
    branches.push(
      `${alias}.schema_id IN (${candidate.relationSchemaIds
        .map(schemaId => addParam(state, schemaId))
        .join(', ')})`
    );
  }

  const identityParts: string[] = [];
  if (candidate.relationIds.length > 0) {
    identityParts.push(
      `${alias}.id IN (${candidate.relationIds.map(id => addParam(state, id)).join(', ')})`
    );
  }
  if (candidate.inEntityIds.length > 0) {
    identityParts.push(
      `${alias}.in_record_id IN (${candidate.inEntityIds
        .map(id => addParam(state, id))
        .join(', ')})`
    );
  }
  if (candidate.outEntityIds.length > 0) {
    identityParts.push(
      `${alias}.out_record_id IN (${candidate.outEntityIds
        .map(id => addParam(state, id))
        .join(', ')})`
    );
  }
  if (identityParts.length > 0) branches.push(`(${identityParts.join(' AND ')})`);

  if (branches.length === 0) return null;
  return branches.length === 1 ? branches[0]! : `(${branches.join(' OR ')})`;
};

const relationTemporalSourceClause = (alias: string, state: EntityQuerySqlRenderState): string => {
  const clauses: string[] = [];
  const sourceSchemaIds = relationSourceSchemaIds(state);
  if (sourceSchemaIds.length > 0) clauses.push(relationSourceSchemaClause(alias, state));

  const rootCandidateClause = relationRootTemporalCandidateClause(alias, state);
  if (rootCandidateClause) clauses.push(rootCandidateClause);

  if (clauses.length === 0) return '1=1';
  return clauses.length === 1 ? clauses[0]! : `(${clauses.join(' OR ')})`;
};

const relationSourceConstraintClause = (
  relationAlias: string,
  inEndpointAlias: string,
  outEndpointAlias: string,
  state: EntityQuerySqlRenderState
): string => {
  if (state.relationSourceConstraints.length === 0) return '1=1';

  return `(${state.relationSourceConstraints
    .map(constraint => {
      const schemaClause = `${relationAlias}.schema_id = ${addParam(state, constraint.relationSchemaId)}`;
      if (!constraint.ownerDirection || !constraint.ownerSchemaIds) return schemaClause;
      const endpointAlias = constraint.ownerDirection === 'in' ? inEndpointAlias : outEndpointAlias;
      const ownerSchemaClause =
        constraint.ownerSchemaIds.length === 0
          ? '1=0'
          : `${endpointAlias}.schema_id IN (${constraint.ownerSchemaIds
              .map(schemaId => addParam(state, schemaId))
              .join(', ')})`;
      return `(${schemaClause} AND ${ownerSchemaClause})`;
    })
    .join(' OR ')})`;
};

const projectScopeClause = (
  entityIdColumn: string,
  workspaceColumn: string,
  projectColumn: string,
  state: EntityQuerySqlRenderState
): string => {
  if (!state.projectId) {
    if (state.projectScope === 'project') {
      throw new UnsupportedEntityQueryIRError(
        "projectScope 'project' requires EntityQuery.projectId to be set"
      );
    }
    return `${projectColumn} IS NULL`;
  }

  const ownedProjectParam = addParam(state, state.projectId);
  if (state.projectScope === 'project') {
    const linkedProjectParam = addParam(state, state.projectId);
    return (
      `(${projectColumn} = ${ownedProjectParam} OR EXISTS (` +
      `SELECT 1 FROM project_entity pe ` +
      `WHERE pe.workspace = ${workspaceColumn} ` +
      `AND pe.project_id = ${linkedProjectParam} ` +
      `AND pe.entity_id = ${entityIdColumn}))`
    );
  }

  return `(${projectColumn} IS NULL OR ${projectColumn} = ${ownedProjectParam})`;
};

const temporalEntityProjection = (
  stateColumn: string,
  entityIdColumn: string,
  workspaceColumn: string,
  state: EntityQuerySqlRenderState
): string => {
  const text = (fieldId: string) => state.dialectAdapter.stateText(stateColumn, fieldId);
  const json = (fieldId: string) => state.dialectAdapter.stateValue(stateColumn, fieldId);
  const uuid = (fieldId: string) => state.dialectAdapter.uuidFromText(text(fieldId));
  const emptyObject = state.dialectAdapter.emptyObject;
  const emptyArray = state.dialectAdapter.emptyArray;
  const entityIdText = state.dialectAdapter.textCast(entityIdColumn);

  return [
    `${entityIdColumn} AS id`,
    `${workspaceColumn} AS workspace`,
    `COALESCE(${text('public_id')}, ${entityIdText}) AS public_id`,
    `${text('slug')} AS slug`,
    `COALESCE(${text('namespace')}, 'default') AS namespace`,
    `COALESCE(${text('name')}, '') AS name`,
    `COALESCE(${text('description')}, '') AS description`,
    `${uuid('owner')} AS owner`,
    `${uuid('lifecycle')} AS lifecycle`,
    `${uuid('target_lifecycle')} AS target_lifecycle`,
    `${text('target_lifecycle_date')} AS target_lifecycle_date`,
    `COALESCE(${json('tags')}, ${emptyArray}) AS tags`,
    `COALESCE(${json('links')}, ${emptyArray}) AS links`,
    `${uuid('schema_id')} AS schema_id`,
    `COALESCE(${json('data')}, ${emptyObject}) AS data`,
    `${text('project_id')} AS project_id`,
    `${text('created_at')} AS created_at`,
    `${text('updated_at')} AS updated_at`,
    `COALESCE(${text('version')}, '1') AS version`,
    // Versions written before #2346 have no frozen completeness in their state JSON; default to 0
    // rather than surface NULL through a column callers otherwise treat as always-present.
    `COALESCE(${text('completeness')}, '0') AS completeness`,
    `COALESCE(${json('generated_metadata')}, ${emptyObject}) AS generated_metadata`,
    `${text('approval_policy_override')} AS approval_policy_override`
  ].join(',\n      ');
};

const buildTemporalSource = (state: EntityQuerySqlRenderState): string => {
  const asOf = state.asOf!;
  const workspaceParam = addParam(state, state.workspace);
  const asOfParam = addParam(state, asOf.toISOString());
  const projectClause = projectScopeClause(
    'v.record_id',
    'v.workspace',
    state.dialectAdapter.stateText('v.state', 'project_id'),
    state
  );
  const temporalProjection = temporalEntityProjection(
    'final_state.state',
    'final_state.record_id',
    'final_state.workspace',
    state
  );

  const fallbackWorkspaceParam = addParam(state, state.workspace);
  const fallbackCreatedParam = addParam(state, asOf.toISOString());
  const fallbackProjectClause = projectScopeClause('e.id', 'e.workspace', 'e.project_id', state);
  const eventWorkspaceParam = addParam(state, state.workspace);
  const eventCreatedParam = addParam(state, asOf.toISOString());
  const eventDateParam = addParam(state, asOf.toISOString().slice(0, 10));
  const caseProjectClause =
    state.projectScope === 'project' && state.projectId && state.includePlannedChanges
      ? `(c.project_id IS NULL OR c.project_id = ${addParam(state, state.projectId)})`
      : 'c.project_id IS NULL';
  const temporalScopeClause = projectScopeClause(
    'final_state.record_id',
    'final_state.workspace',
    state.dialectAdapter.stateText('final_state.state', 'project_id'),
    state
  );
  const visibleClause =
    state.visibleEntityIds == null
      ? ''
      : state.visibleEntityIds.length === 0
        ? '1=0'
        : `final_state.record_id IN (${state.visibleEntityIds.map(id => addParam(state, id)).join(', ')})`;
  const collectionClause =
    state.collectionEntityIds == null
      ? ''
      : state.collectionEntityIds.length === 0
        ? '1=0'
        : `final_state.record_id IN (${state.collectionEntityIds.map(id => addParam(state, id)).join(', ')})`;
  const temporalScope = `${temporalScopeClause} AND ${visibleClause || '1=1'} AND ${collectionClause || '1=1'}`;

  return `
    latest_entity_version AS (
      SELECT v.*,
             ROW_NUMBER() OVER (
               PARTITION BY v.record_id
               ORDER BY v.created_at DESC, v.version_number DESC
             ) AS row_number
      FROM record_version v
      -- record_version is shared with relation instances (#2687) — without this join, a
      -- relation's version rows would be reconstructed as phantom near-empty "entities" here.
      JOIN catalog_record cr ON cr.id = v.record_id AND cr.kind = 'entity'
      WHERE v.workspace = ${workspaceParam}
        AND v.created_at <= ${asOfParam}
    ),
    baseline_entity_state AS (
      SELECT v.record_id, v.workspace, v.state
      FROM latest_entity_version v
      WHERE v.row_number = 1
        AND v.kind <> 'deleted'
        AND ${projectClause}
      UNION ALL
      SELECT e.id, e.workspace, ${state.dialectAdapter.liveEntityState('e')}
      FROM catalog_record e
      WHERE e.kind = 'entity'
        AND e.workspace = ${fallbackWorkspaceParam}
        AND e.deleted_at IS NULL
        AND e.created_at <= ${fallbackCreatedParam}
        AND NOT EXISTS (
          SELECT 1 FROM record_version any_version
          WHERE any_version.workspace = e.workspace
            AND any_version.record_id = e.id
        )
        AND ${fallbackProjectClause}
    ),
    active_future_events AS (
      SELECT m.record_id,
             c.id AS case_id,
             COALESCE(c.effective_date, pm.target_date) AS effective_date,
             r.created_at,
             r.revision_number,
             m.proposed_state,
             ROW_NUMBER() OVER (
               PARTITION BY m.record_id
               ORDER BY COALESCE(c.effective_date, pm.target_date), r.created_at,
                        r.revision_number, c.id
             ) AS event_number
      FROM record_change_case_record_version m
      JOIN entity_change_case_revision r
        ON r.id = m.revision_id
       AND r.is_active = ${state.dialectAdapter.trueLiteral}
      JOIN entity_change_case c ON c.id = r.case_id
      LEFT JOIN project_milestone pm ON pm.id = c.milestone_id AND pm.workspace = c.workspace
      WHERE c.workspace = ${eventWorkspaceParam}
        AND c.purpose = 'planned_change'
        AND c.status IN ('planned', 'in_approval')
        AND r.status IN ('draft', 'submitted', 'changes_requested')
        AND r.created_at <= ${eventCreatedParam}
        AND COALESCE(c.effective_date, pm.target_date) IS NOT NULL
        AND COALESCE(c.effective_date, pm.target_date) <= ${eventDateParam}
        AND ${caseProjectClause}
    ),
    future_state (record_id, workspace, state, event_number) AS (
      SELECT b.record_id, b.workspace, b.state, ${state.dialectAdapter.initialEventNumber}
      FROM baseline_entity_state b
      UNION ALL
      SELECT future_state.record_id,
             future_state.workspace,
             ${state.dialectAdapter.mergeJson('future_state.state', 'event.proposed_state')},
             event.event_number
      FROM future_state
      JOIN active_future_events event
        ON event.record_id = future_state.record_id
       AND event.event_number = future_state.event_number + 1
    ),
    final_state AS (
      SELECT record_id, workspace, state,
             ROW_NUMBER() OVER (
               PARTITION BY record_id
               ORDER BY event_number DESC
             ) AS row_number
      FROM future_state
    ),
    temporal_entity_source AS (
      SELECT ${temporalProjection}
      FROM final_state
      WHERE final_state.row_number = 1
        AND ${temporalScope}
    )`;
};

// Builds the one source CTE consumed by every traversal alias. Live queries use catalog_record;
// temporal queries reconstruct a JSON state in SQL and project it into entity-shaped columns.
export const buildScopeCte = (state: EntityQuerySqlRenderState): string => {
  const hasAssessment = state.assessmentId != null;
  const assessmentColumn = hasAssessment
    ? `ar."values" AS assessment_values`
    : `${state.dialectAdapter.nullJson} AS assessment_values`;
  const source = state.asOf ? buildTemporalSource(state) : '';
  const conformanceStatusCte = buildConformanceStatusCte(state);

  if (state.asOf) {
    const assessmentParam = hasAssessment ? addParam(state, state.assessmentId) : null;
    return `${source},\n    ${conformanceStatusCte},\n    ${SCOPE_CTE} AS (\n      SELECT s.*, ${assessmentColumn},\n             cs.conformance_status,\n             cs.conformance_evaluated_at,\n             cs.conformance_stale\n      FROM temporal_entity_source s\n      LEFT JOIN conformance_entity_status cs ON cs.entity_id = s.id\n      LEFT JOIN assessment_response ar\n        ON ar.entity_id = s.id\n       AND ar.assessment_id = ${assessmentParam ?? 'NULL'}\n       AND ar.workspace = s.workspace\n    )`;
  }

  const assessmentParam = hasAssessment ? addParam(state, state.assessmentId) : null;
  const workspaceParam = addParam(state, state.workspace);
  const scopeClause = projectScopeClause('e.id', 'e.workspace', 'e.project_id', state);
  const permissionScope = compileEntityViewPermissionScope(
    state.workspace,
    state.permissionScope ?? null,
    state.dialect,
    value => addParam(state, value),
    'e'
  );
  const visibleClause =
    state.visibleEntityIds == null
      ? ''
      : state.visibleEntityIds.length === 0
        ? '1=0'
        : `e.id IN (${state.visibleEntityIds.map(id => addParam(state, id)).join(', ')})`;
  const collectionClause =
    state.collectionEntityIds == null
      ? ''
      : state.collectionEntityIds.length === 0
        ? '1=0'
        : `e.id IN (${state.collectionEntityIds.map(id => addParam(state, id)).join(', ')})`;
  const scopedWhere = `${scopeClause} AND ${visibleClause || '1=1'} AND ${collectionClause || '1=1'} AND ${permissionScope.predicate}`;
  return `${permissionScope.cte ? `${permissionScope.cte},\n    ` : ''}${conformanceStatusCte},\n    ${SCOPE_CTE} AS (\n      SELECT e.*, ${assessmentColumn},\n             cs.conformance_status,\n             cs.conformance_evaluated_at,\n             cs.conformance_stale\n      FROM catalog_record e\n      LEFT JOIN conformance_entity_status cs ON cs.entity_id = e.id\n      LEFT JOIN assessment_response ar\n        ON ar.entity_id = e.id\n       AND ar.assessment_id = ${assessmentParam ?? 'NULL'}\n       AND ar.workspace = e.workspace\n      WHERE e.kind = 'entity'\n        AND e.workspace = ${workspaceParam}\n        AND e.deleted_at IS NULL\n        AND ${scopedWhere}\n    )`;
};

const temporalRelationProjection = (
  stateColumn: string,
  recordIdColumn: string,
  workspaceColumn: string,
  state: EntityQuerySqlRenderState
): string => {
  const text = (fieldId: string) => state.dialectAdapter.stateText(stateColumn, fieldId);
  const json = (fieldId: string) => state.dialectAdapter.stateValue(stateColumn, fieldId);
  const uuid = (fieldId: string) => state.dialectAdapter.uuidFromText(text(fieldId));
  const emptyObject = state.dialectAdapter.emptyObject;

  return [
    `${recordIdColumn} AS id`,
    `${workspaceColumn} AS workspace`,
    `${uuid('schema_id')} AS schema_id`,
    `${uuid('in_entity_id')} AS in_record_id`,
    `${uuid('out_entity_id')} AS out_record_id`,
    `COALESCE(${json('data')}, ${emptyObject}) AS data`,
    `${uuid('owner')} AS owner`,
    `${uuid('lifecycle')} AS lifecycle`,
    `COALESCE(${text('version')}, '1') AS version`,
    `${text('approval_policy_override')} AS approval_policy_override`,
    `${text('created_at')} AS created_at`,
    `${text('updated_at')} AS updated_at`
  ].join(',\n      ');
};

const buildTemporalRelationSource = (state: EntityQuerySqlRenderState): string => {
  const asOf = state.asOf!;
  const workspaceParam = addParam(state, state.workspace);
  const asOfParam = addParam(state, asOf.toISOString());
  const temporalRelationSource = relationTemporalSourceClause('cr', state);
  const fallbackWorkspaceParam = addParam(state, state.workspace);
  const fallbackCreatedParam = addParam(state, asOf.toISOString());
  const fallbackRelationSourceClause = relationTemporalSourceClause('r', state);
  const eventWorkspaceParam = addParam(state, state.workspace);
  const eventCreatedParam = addParam(state, asOf.toISOString());
  const eventDateParam = addParam(state, asOf.toISOString().slice(0, 10));
  const caseProjectClause =
    state.projectScope === 'project' && state.projectId && state.includePlannedChanges
      ? `(c.project_id IS NULL OR c.project_id = ${addParam(state, state.projectId)})`
      : 'c.project_id IS NULL';
  const projection = temporalRelationProjection(
    'final_relation_state.state',
    'final_relation_state.record_id',
    'final_relation_state.workspace',
    state
  );
  const eventRelationSourceClause = relationTemporalSourceClause('cr', state);

  return `
    latest_relation_version AS (
      SELECT v.*,
             ROW_NUMBER() OVER (
               PARTITION BY v.record_id
               ORDER BY v.created_at DESC, v.version_number DESC
             ) AS row_number
      FROM record_version v
      -- record_version is shared with entities — restrict to relation-owned versions only.
      JOIN catalog_record cr ON cr.id = v.record_id AND cr.kind = 'relation'
      WHERE v.workspace = ${workspaceParam}
        AND v.created_at <= ${asOfParam}
        AND ${temporalRelationSource}
    ),
    baseline_relation_state AS (
      SELECT v.record_id, v.workspace, v.state
      FROM latest_relation_version v
      WHERE v.row_number = 1
        AND v.kind <> 'deleted'
      UNION ALL
      SELECT r.id, r.workspace, ${state.dialectAdapter.liveRelationState('r')}
      FROM catalog_record r
      WHERE r.kind = 'relation'
        AND r.workspace = ${fallbackWorkspaceParam}
        AND r.deleted_at IS NULL
        AND r.created_at <= ${fallbackCreatedParam}
        AND ${fallbackRelationSourceClause}
        AND NOT EXISTS (
          SELECT 1 FROM record_version any_version
          WHERE any_version.workspace = r.workspace
            AND any_version.record_id = r.id
        )
    ),
    active_future_relation_events AS (
      SELECT m.record_id,
             c.id AS case_id,
             COALESCE(c.effective_date, pm.target_date) AS effective_date,
             r.created_at,
             r.revision_number,
             m.proposed_state,
             ROW_NUMBER() OVER (
               PARTITION BY m.record_id
               ORDER BY COALESCE(c.effective_date, pm.target_date), r.created_at,
                        r.revision_number, c.id
             ) AS event_number
      FROM record_change_case_record_version m
      JOIN catalog_record cr ON cr.id = m.record_id AND cr.kind = 'relation'
      JOIN entity_change_case_revision r
        ON r.id = m.revision_id
       AND r.is_active = ${state.dialectAdapter.trueLiteral}
      JOIN entity_change_case c ON c.id = r.case_id
      LEFT JOIN project_milestone pm ON pm.id = c.milestone_id AND pm.workspace = c.workspace
      WHERE c.workspace = ${eventWorkspaceParam}
        AND c.purpose = 'planned_change'
        AND c.status IN ('planned', 'in_approval')
        AND r.status IN ('draft', 'submitted', 'changes_requested')
        AND r.created_at <= ${eventCreatedParam}
        AND COALESCE(c.effective_date, pm.target_date) IS NOT NULL
        AND COALESCE(c.effective_date, pm.target_date) <= ${eventDateParam}
        AND ${caseProjectClause}
        AND ${eventRelationSourceClause}
    ),
    future_relation_state (record_id, workspace, state, event_number) AS (
      SELECT b.record_id, b.workspace, b.state, ${state.dialectAdapter.initialEventNumber}
      FROM baseline_relation_state b
      UNION ALL
      SELECT future_relation_state.record_id,
             future_relation_state.workspace,
             ${state.dialectAdapter.mergeJson(
               'future_relation_state.state',
               'event.proposed_state'
             )},
             event.event_number
      FROM future_relation_state
      JOIN active_future_relation_events event
        ON event.record_id = future_relation_state.record_id
       AND event.event_number = future_relation_state.event_number + 1
    ),
    final_relation_state AS (
      SELECT record_id, workspace, state,
             ROW_NUMBER() OVER (
               PARTITION BY record_id
               ORDER BY event_number DESC
             ) AS row_number
      FROM future_relation_state
    ),
    temporal_relation_source AS (
      SELECT ${projection}
      FROM final_relation_state
      WHERE final_relation_state.row_number = 1
    )`;
};

// Relation-instance counterpart of buildScopeCte. Live queries read catalog_record directly;
// temporal queries reconstruct relation state from record_version.
export const buildRelationScopeCte = (state: EntityQuerySqlRenderState): string => {
  const policy = state.relationVisibility;
  const needsEndpointJoins = policy != null;
  const endpointJoins = needsEndpointJoins
    ? `
      JOIN catalog_record in_visibility_endpoint
        ON in_visibility_endpoint.workspace = r.workspace
       AND in_visibility_endpoint.id = r.in_record_id
       AND in_visibility_endpoint.kind = 'entity'
      JOIN catalog_record out_visibility_endpoint
        ON out_visibility_endpoint.workspace = r.workspace
       AND out_visibility_endpoint.id = r.out_record_id
       AND out_visibility_endpoint.kind = 'entity'`
    : '';
  const needsSourceEndpointJoins = state.relationSourceConstraints.some(
    constraint => constraint.ownerDirection != null
  );
  const sourceEndpointJoins = needsSourceEndpointJoins
    ? `
      LEFT JOIN ${SCOPE_CTE} in_relation_source_endpoint
        ON in_relation_source_endpoint.workspace = r.workspace
       AND in_relation_source_endpoint.id = r.in_record_id
      LEFT JOIN ${SCOPE_CTE} out_relation_source_endpoint
        ON out_relation_source_endpoint.workspace = r.workspace
       AND out_relation_source_endpoint.id = r.out_record_id`
    : '';
  if (state.asOf) {
    const source = buildTemporalRelationSource(state);
    const sourceClause = relationSourceConstraintClause(
      'r',
      'in_relation_source_endpoint',
      'out_relation_source_endpoint',
      state
    );
    const visibilityClause = relationVisibilityClause(
      'r',
      'in_visibility_endpoint',
      'out_visibility_endpoint',
      state
    );
    return `${source},\n    ${RELATION_SCOPE_CTE} AS (\n      SELECT r.*\n      FROM temporal_relation_source r${sourceEndpointJoins}${endpointJoins}\n      WHERE ${sourceClause} AND ${visibilityClause}\n    )`;
  }
  const workspaceParam = addParam(state, state.workspace);
  const sourceClause = relationSourceConstraintClause(
    'r',
    'in_relation_source_endpoint',
    'out_relation_source_endpoint',
    state
  );
  const visibilityClause = relationVisibilityClause(
    'r',
    'in_visibility_endpoint',
    'out_visibility_endpoint',
    state
  );
  return `${RELATION_SCOPE_CTE} AS (\n      SELECT r.*\n      FROM catalog_record r${sourceEndpointJoins}${endpointJoins}\n      WHERE r.kind = 'relation'\n        AND r.workspace = ${workspaceParam}\n        AND r.deleted_at IS NULL\n        AND ${sourceClause}\n        AND ${visibilityClause}\n    )`;
};
