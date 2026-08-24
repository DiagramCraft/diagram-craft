import type {
  ConformanceCheckDefinition,
  ConformanceCheckStatus,
  ConformanceSeverity
} from '@arch-register/api-types/conformanceContract';
import { databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

export type ConformanceCheckDbResult = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  severity: ConformanceSeverity;
  enabled: boolean;
  definition: ConformanceCheckDefinition;
  revision: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ConformanceCheckDbCreate = ConformanceCheckDbResult;

export type ConformanceCheckDbUpdate = {
  name?: string;
  description?: string | null;
  severity?: ConformanceSeverity;
  enabled?: boolean;
  definition?: ConformanceCheckDefinition;
  revision: number;
  updated_at: Date;
};

export type ConformanceRunStatus = 'running' | 'succeeded' | 'failed';

export type ConformanceRunDbResult = {
  id: string;
  workspace: string;
  check_id: string | null;
  job_run_id: string | null;
  status: ConformanceRunStatus;
  started_at: Date;
  completed_at: Date | null;
  checked_count: number;
  violation_count: number;
  error: string | null;
  configuration: Record<string, unknown>;
};

export type ConformanceRunDbCreate = ConformanceRunDbResult;

export type ConformanceRunDbUpdate = {
  status: ConformanceRunStatus;
  completed_at: Date | null;
  checked_count: number;
  violation_count: number;
  error: string | null;
};

export type ConformanceExemptionDbResult = {
  id: string;
  workspace: string;
  violation_id: string;
  reason: string;
  expires_at: Date | null;
  created_by: string | null;
  created_at: Date;
  revoked_at: Date | null;
};

export type ConformanceViolationDbResult = {
  id: string;
  workspace: string;
  check_id: string;
  check_name: string;
  entity_id: string;
  entity_name: string | null;
  schema_id: string | null;
  owner_team_id: string | null;
  source_type: 'scheduled_validation' | 'query_policy' | 'ai_prompt';
  severity: ConformanceSeverity;
  message: string;
  evidence: Record<string, unknown>;
  status: ConformanceCheckStatus;
  first_seen_at: Date;
  last_seen_at: Date;
  resolved_at: Date | null;
  exemption: ConformanceExemptionDbResult | null;
};

export type ConformanceViolationUpsert = {
  id: string;
  workspace: string;
  check_id: string;
  entity_id: string;
  entity_name: string | null;
  schema_id: string | null;
  severity: ConformanceSeverity;
  message: string;
  evidence: Record<string, unknown>;
  run_id: string | null;
  seen_at: Date;
};

export type ConformanceEntityEvaluationUpsert = {
  workspace: string;
  check_id: string;
  entity_id: string;
  check_revision: number;
  run_id: string | null;
  evaluated_at: Date;
};

export type ConformanceViolationEventType =
  | 'observed'
  | 'acknowledged'
  | 'resolved'
  | 'exempted'
  | 'exemption_revoked';

export type ConformanceViolationEventDbCreate = {
  id: string;
  workspace: string;
  violation_id: string;
  run_id: string | null;
  event_type: ConformanceViolationEventType;
  details: Record<string, unknown>;
  occurred_at: Date;
};

export type ConformanceViolationEventDbResult = ConformanceViolationEventDbCreate;

export type ConformanceViolationListOptions = {
  check_id?: string;
  entity_id?: string;
  schema_id?: string;
  owner_id?: string;
  status?: ConformanceCheckStatus;
  severity?: ConformanceSeverity;
  limit: number;
  offset: number;
};

export type ConformanceViolationCounts = {
  active: number;
  acknowledged: number;
  warnings: number;
  errors: number;
  exempt: number;
  resolvedRecently: number;
};

export type ConformanceDatabase = {
  listChecks(workspace: string): Promise<ConformanceCheckDbResult[]>;
  getCheck(workspace: string, id: string): Promise<ConformanceCheckDbResult | null>;
  createCheck(input: ConformanceCheckDbCreate): Promise<ConformanceCheckDbResult>;
  updateCheck(
    workspace: string,
    id: string,
    input: ConformanceCheckDbUpdate
  ): Promise<ConformanceCheckDbResult | null>;
  deleteCheck(workspace: string, id: string): Promise<ConformanceCheckDbResult | null>;

  createRun(input: ConformanceRunDbCreate): Promise<ConformanceRunDbResult>;
  getRun(workspace: string, id: string): Promise<ConformanceRunDbResult | null>;
  listRuns(workspace: string, limit: number): Promise<ConformanceRunDbResult[]>;
  updateRun(
    workspace: string,
    id: string,
    input: ConformanceRunDbUpdate
  ): Promise<ConformanceRunDbResult | null>;

  getViolation(workspace: string, id: string): Promise<ConformanceViolationDbResult | null>;
  listViolations(
    workspace: string,
    options: ConformanceViolationListOptions
  ): Promise<{ items: ConformanceViolationDbResult[]; total: number }>;
  countViolations(workspace: string): Promise<ConformanceViolationCounts>;
  recordEntityEvaluations(input: ConformanceEntityEvaluationUpsert[]): Promise<void>;
  upsertViolation(input: ConformanceViolationUpsert): Promise<ConformanceViolationDbResult>;
  setViolationStatus(
    workspace: string,
    id: string,
    status: 'active' | 'acknowledged' | 'resolved',
    changedAt: Date,
    details: Record<string, unknown>
  ): Promise<ConformanceViolationDbResult | null>;
  createViolationEvent(input: ConformanceViolationEventDbCreate): Promise<void>;
  listViolationEvents(
    workspace: string,
    violationId: string
  ): Promise<ConformanceViolationEventDbResult[]>;
  resolveUnseenViolations(
    workspace: string,
    checkId: string,
    seenEntityIds: string[],
    resolvedAt: Date,
    runId: string | null
  ): Promise<string[]>;
  createExemption(input: ConformanceExemptionDbResult): Promise<ConformanceExemptionDbResult>;
  revokeExemption(
    workspace: string,
    violationId: string,
    revokedAt: Date
  ): Promise<ConformanceViolationDbResult | null>;
};

export const conformanceMappers = {
  check: (row: DatabaseRow): ConformanceCheckDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    description: row['description'] == null ? null : String(row['description']),
    severity: String(row['severity']) as ConformanceSeverity,
    enabled: Boolean(Number(row['enabled'] ?? 0)),
    definition: parseDatabaseJson<ConformanceCheckDefinition>(
      row['definition'],
      { type: 'query_policy', query: { root: { kind: 'and', children: [] } }, message: '' },
      'conformance_check.definition'
    ),
    revision: Number(row['revision'] ?? 1),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  run: (row: DatabaseRow): ConformanceRunDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    check_id: row['check_id'] == null ? null : String(row['check_id']),
    job_run_id: row['job_run_id'] == null ? null : String(row['job_run_id']),
    status: String(row['status']) as ConformanceRunStatus,
    started_at: databaseDate(row['started_at']),
    completed_at: row['completed_at'] == null ? null : databaseDate(row['completed_at']),
    checked_count: Number(row['checked_count'] ?? 0),
    violation_count: Number(row['violation_count'] ?? 0),
    error: row['error'] == null ? null : String(row['error']),
    configuration: parseDatabaseJson<Record<string, unknown>>(
      row['configuration'],
      {},
      'conformance_evaluation_run.configuration'
    )
  }),
  exemption: (row: DatabaseRow): ConformanceExemptionDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    violation_id: String(row['violation_id']),
    reason: String(row['reason']),
    expires_at: row['expires_at'] == null ? null : databaseDate(row['expires_at']),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    created_at: databaseDate(row['created_at']),
    revoked_at: row['revoked_at'] == null ? null : databaseDate(row['revoked_at'])
  }),
  violationEvent: (row: DatabaseRow): ConformanceViolationEventDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    violation_id: String(row['violation_id']),
    run_id: row['run_id'] == null ? null : String(row['run_id']),
    event_type: String(row['event_type']) as ConformanceViolationEventType,
    details: parseDatabaseJson<Record<string, unknown>>(
      row['details'],
      {},
      'conformance_violation_event.details'
    ),
    occurred_at: databaseDate(row['occurred_at'])
  }),
  violation: (row: DatabaseRow): ConformanceViolationDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    check_id: String(row['check_id']),
    check_name: String(row['check_name']),
    entity_id: String(row['entity_id']),
    entity_name: row['entity_name'] == null ? null : String(row['entity_name']),
    schema_id: row['schema_id'] == null ? null : String(row['schema_id']),
    owner_team_id: row['owner_team_id'] == null ? null : String(row['owner_team_id']),
    source_type: String(row['source_type']) as ConformanceViolationDbResult['source_type'],
    severity: String(row['severity']) as ConformanceSeverity,
    message: String(row['message']),
    evidence: parseDatabaseJson<Record<string, unknown>>(
      row['evidence'],
      {},
      'conformance_violation.evidence'
    ),
    status: String(row['status']) as ConformanceCheckStatus,
    first_seen_at: databaseDate(row['first_seen_at']),
    last_seen_at: databaseDate(row['last_seen_at']),
    resolved_at: row['resolved_at'] == null ? null : databaseDate(row['resolved_at']),
    exemption:
      row['exemption_id'] == null
        ? null
        : {
            id: String(row['exemption_id']),
            workspace: String(row['workspace']),
            violation_id: String(row['id']),
            reason: String(row['exemption_reason']),
            expires_at:
              row['exemption_expires_at'] == null
                ? null
                : databaseDate(row['exemption_expires_at']),
            created_by:
              row['exemption_created_by'] == null ? null : String(row['exemption_created_by']),
            created_at: databaseDate(row['exemption_created_at']),
            revoked_at:
              row['exemption_revoked_at'] == null ? null : databaseDate(row['exemption_revoked_at'])
          }
  })
};
