import { randomUUID } from 'node:crypto';
import type {
  ConformanceCheck,
  ConformanceCheckDefinition,
  ConformanceExemptionRequest,
  ConformanceSummary,
  CreateConformanceCheck,
  UpdateConformanceCheck
} from '@arch-register/api-types/conformanceContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type {
  AuthorizationContext,
  WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireWorkspaceCapability, buildApiEntityAuthCtx } from '../auth/authorization';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { assertValidationRulesValid } from '../catalog/entityValidationRules';
import { validateEntityQueryIR } from '../catalog/entityQueryIRValidator';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import { resolveAiConfig } from '../ai/tanstackAiAdapter';
import { httpAssert } from '../../utils/httpAssert';
import type {
  ConformanceCheckDbResult,
  ConformanceExemptionDbResult,
  ConformanceRunDbResult,
  ConformanceViolationDbResult
} from './db/conformanceDatabase';
import { CONFORMANCE_SCAN_JOB_TYPE, CONFORMANCE_SCAN_SYSTEM_IDENTITY } from './conformanceJob';

const checker = new PermissionChecker();

const normalizeDefinition = (
  definition: ConformanceCheckDefinition
): ConformanceCheckDefinition => ({
  ...definition,
  governance: definition.governance ?? { enabled: false, resolution: 'acknowledge' }
});

const toApiCheck = (check: ConformanceCheckDbResult): ConformanceCheck => ({
  id: check.id,
  workspace: check.workspace,
  name: check.name,
  description: check.description,
  severity: check.severity,
  enabled: check.enabled,
  definition: check.definition,
  revision: check.revision,
  created_by: check.created_by,
  created_at: check.created_at.toISOString(),
  updated_at: check.updated_at.toISOString()
});

const toApiRun = (run: ConformanceRunDbResult) => ({
  id: run.id,
  workspace: run.workspace,
  check_id: run.check_id,
  job_run_id: run.job_run_id,
  status: run.status,
  started_at: run.started_at.toISOString(),
  completed_at: run.completed_at?.toISOString() ?? null,
  checked_count: run.checked_count,
  violation_count: run.violation_count,
  error: run.error,
  configuration: run.configuration
});

const toApiViolation = (violation: ConformanceViolationDbResult) => ({
  id: violation.id,
  workspace: violation.workspace,
  check_id: violation.check_id,
  check_name: violation.check_name,
  entity_id: violation.entity_id,
  entity_name: violation.entity_name,
  schema_id: violation.schema_id,
  owner_team_id: violation.owner_team_id,
  source_type: violation.source_type,
  severity: violation.severity,
  message: violation.message,
  evidence: violation.evidence,
  status: violation.status,
  first_seen_at: violation.first_seen_at.toISOString(),
  last_seen_at: violation.last_seen_at.toISOString(),
  resolved_at: violation.resolved_at?.toISOString() ?? null,
  exemption: violation.exemption
    ? {
        id: violation.exemption.id,
        violation_id: violation.exemption.violation_id,
        reason: violation.exemption.reason,
        expires_at: violation.exemption.expires_at?.toISOString() ?? null,
        created_by: violation.exemption.created_by,
        created_at: violation.exemption.created_at.toISOString(),
        revoked_at: violation.exemption.revoked_at?.toISOString() ?? null
      }
    : null
});

const assertQueryIsWorkspaceLiveEntityQuery = (
  query: EntityQuery,
  schemas: Awaited<ReturnType<DatabaseAdapter['catalog']['listSchemas']>>,
  relationSchemas: Awaited<ReturnType<DatabaseAdapter['relation']['listRelationSchemas']>>,
  authCtx: WorkspaceAuthorizationContext
) => {
  httpAssert.true(query.root_kind !== 'relation', {
    status: 400,
    message: 'Conformance policies must be rooted in entities'
  });
  for (const [field, label] of [
    ['projectId', 'project-scoped queries'],
    ['collectionId', 'personal collections'],
    ['asOf', 'historical queries'],
    ['assessmentId', 'assessment queries']
  ] as const) {
    httpAssert.true(query[field] === undefined, {
      status: 400,
      message: `Conformance policies cannot use ${label}`
    });
  }
  const result = validateEntityQueryIR(
    query,
    new Map(schemas.map(schema => [schema.id, schema])),
    authCtx,
    new Map(relationSchemas.map(schema => [schema.id, schema]))
  );
  httpAssert.true(result.ok, {
    status: 400,
    message: result.ok ? undefined : result.errors.map(error => error.message).join('; ')
  });
};

const assertDefinitionValid = async (
  db: DatabaseAdapter,
  workspace: string,
  definition: ConformanceCheckDefinition,
  authCtx: WorkspaceAuthorizationContext
) => {
  const [schemas, relationSchemas] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.relation.listRelationSchemas(workspace)
  ]);
  if (definition.type === 'scheduled_validation') {
    const schema = schemas.find(candidate => candidate.id === definition.schemaId);
    httpAssert.present(schema, {
      status: 400,
      message: `Schema '${definition.schemaId}' not found`
    });
    if (definition.fieldId) {
      httpAssert.true(
        schema.fields.some(field => field.id === definition.fieldId),
        {
          status: 400,
          message: `Field '${definition.fieldId}' is not part of schema '${schema.id}'`
        }
      );
    }
    assertValidationRulesValid([
      {
        id: 'conformance-check',
        name: 'Conformance check',
        expression: definition.expression,
        message: definition.message,
        severity: 'error',
        ...(definition.fieldId ? { fieldId: definition.fieldId } : {}),
        active: true
      }
    ]);
    return;
  }
  if (definition.type === 'query_policy') {
    assertQueryIsWorkspaceLiveEntityQuery(definition.query, schemas, relationSchemas, authCtx);
    return;
  }
  const aiConfig = await resolveAiConfig(db, workspace);
  httpAssert.present(aiConfig, {
    status: 409,
    statusText: 'Conflict',
    message: 'AI conformance checks require AI to be enabled for this workspace'
  });
  const schema = schemas.find(candidate => candidate.id === definition.schemaId);
  httpAssert.present(schema, { status: 400, message: `Schema '${definition.schemaId}' not found` });
  httpAssert.true(new Set(definition.fieldIds).size === definition.fieldIds.length, {
    status: 400,
    message: 'AI conformance fields must be unique'
  });
  for (const fieldId of definition.fieldIds) {
    httpAssert.true(
      schema.fields.some(field => field.id === fieldId),
      {
        status: 400,
        message: `Field '${fieldId}' is not part of schema '${schema.id}'`
      }
    );
    httpAssert.true(!isFieldViewRestricted(authCtx, schema, fieldId), {
      status: 403,
      message: `You cannot grant an AI check access to field '${fieldId}'`
    });
  }
};

export const listConformanceChecks = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext
) => {
  requireWorkspaceCapability(authCtx, 'ws.view');
  return (await db.conformance.listChecks(workspace)).map(toApiCheck);
};

export const createConformanceCheck = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateConformanceCheck,
  authCtx: WorkspaceAuthorizationContext,
  event: AuthenticatedEvent
) => {
  requireWorkspaceCapability(authCtx, 'ws.settings');
  await assertDefinitionValid(db, workspace, body.definition, authCtx);
  const now = new Date();
  const userId = event.context.user.id;
  const check = await db.conformance.createCheck({
    id: randomUUID(),
    workspace,
    name: body.name,
    description: body.description ?? null,
    severity: body.severity,
    enabled: body.enabled,
    definition: normalizeDefinition(body.definition),
    revision: 1,
    created_by: userId,
    created_at: now,
    updated_at: now
  });
  return toApiCheck(check);
};

export const updateConformanceCheck = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateConformanceCheck,
  authCtx: WorkspaceAuthorizationContext
) => {
  requireWorkspaceCapability(authCtx, 'ws.settings');
  const existing = await db.conformance.getCheck(workspace, id);
  httpAssert.present(existing, { status: 404, message: 'Conformance check not found' });
  if (body.definition) await assertDefinitionValid(db, workspace, body.definition, authCtx);
  const updated = await db.conformance.updateCheck(workspace, id, {
    ...body,
    ...(body.definition ? { definition: normalizeDefinition(body.definition) } : {}),
    revision: existing.revision + 1,
    updated_at: new Date()
  });
  httpAssert.present(updated, { status: 404, message: 'Conformance check not found' });
  return toApiCheck(updated);
};

export const deleteConformanceCheck = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  authCtx: WorkspaceAuthorizationContext
) => {
  requireWorkspaceCapability(authCtx, 'ws.settings');
  const deleted = await db.conformance.deleteCheck(workspace, id);
  httpAssert.present(deleted, { status: 404, message: 'Conformance check not found' });
  return { success: true };
};

export const startConformanceRun = async (
  db: DatabaseAdapter,
  workspace: string,
  checkId: string | undefined,
  authCtx: WorkspaceAuthorizationContext
) => {
  requireWorkspaceCapability(authCtx, 'ws.settings');
  if (checkId) {
    const check = await db.conformance.getCheck(workspace, checkId);
    httpAssert.present(check, { status: 404, message: 'Conformance check not found' });
  }
  const now = new Date();
  const run = await db.conformance.createRun({
    id: randomUUID(),
    workspace,
    check_id: checkId ?? null,
    job_run_id: null,
    status: 'running',
    started_at: now,
    completed_at: null,
    checked_count: 0,
    violation_count: 0,
    error: null,
    configuration: { checkId: checkId ?? null }
  });
  try {
    await enqueueOneOffJobRun(db, {
      workspace,
      jobType: CONFORMANCE_SCAN_JOB_TYPE,
      systemIdentity: CONFORMANCE_SCAN_SYSTEM_IDENTITY,
      payload: { evaluationRunId: run.id, checkId: checkId ?? null },
      priority: 5,
      maxAttempts: 1,
      dedupeKey: `conformance:${workspace}:${checkId ?? 'all'}:${run.id}`
    });
  } catch (error) {
    await db.conformance.updateRun(workspace, run.id, {
      status: 'failed',
      completed_at: new Date(),
      checked_count: 0,
      violation_count: 0,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
  return toApiRun(run);
};

export const listConformanceRuns = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext
) => {
  requireWorkspaceCapability(authCtx, 'ws.view');
  return (await db.conformance.listRuns(workspace, 100)).map(toApiRun);
};

const canViewViolation = async (
  db: DatabaseAdapter,
  workspace: string,
  violation: ConformanceViolationDbResult,
  authCtx: AuthorizationContext
) => {
  const entity = await db.catalog.getEntity(workspace, violation.entity_id);
  return entity != null && checker.hasEntityPermission(authCtx, entity, 'view_entity');
};

export const listConformanceViolations = async (
  db: DatabaseAdapter,
  workspace: string,
  query: {
    checkId?: string;
    entityId?: string;
    schemaId?: string;
    ownerId?: string;
    status?: 'active' | 'acknowledged' | 'resolved' | 'exempt';
    severity?: 'error' | 'warning';
    limit: number;
    offset: number;
  },
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiEntityAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  const result = await db.conformance.listViolations(workspace, {
    check_id: query.checkId,
    entity_id: query.entityId,
    schema_id: query.schemaId,
    owner_id: query.ownerId,
    status: query.status,
    severity: query.severity,
    limit: 10000,
    offset: 0
  });
  const visible: ConformanceViolationDbResult[] = [];
  for (const violation of result.items) {
    if (await canViewViolation(db, workspace, violation, authCtx)) visible.push(violation);
  }
  return {
    items: visible.slice(query.offset, query.offset + query.limit).map(toApiViolation),
    total: visible.length,
    limit: query.limit,
    offset: query.offset
  };
};

export const exemptConformanceViolation = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: ConformanceExemptionRequest,
  authCtx: WorkspaceAuthorizationContext,
  event: AuthenticatedEvent
) => {
  requireWorkspaceCapability(authCtx, 'ws.settings');
  const existing = await db.conformance.getViolation(workspace, id);
  httpAssert.present(existing, { status: 404, message: 'Conformance violation not found' });
  const expiresAt = body.expiresAt == null ? null : new Date(body.expiresAt);
  const exemption: ConformanceExemptionDbResult = {
    id: randomUUID(),
    workspace,
    violation_id: id,
    reason: body.reason,
    expires_at: expiresAt,
    created_by: event.context.user.id,
    created_at: new Date(),
    revoked_at: null
  };
  await db.conformance.createExemption(exemption);
  return toApiViolation((await db.conformance.getViolation(workspace, id))!);
};

export const getConformanceSummary = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext,
  event: AuthenticatedEvent
): Promise<ConformanceSummary> => {
  requireWorkspaceCapability(authCtx, 'ws.view');
  const entityAuthCtx = await buildApiEntityAuthCtx(db, workspace, event);
  requireWorkspaceCapability(entityAuthCtx, 'ws.view');
  const [allViolations, runs, schemas] = await Promise.all([
    db.conformance.listViolations(workspace, { limit: 10000, offset: 0 }),
    db.conformance.listRuns(workspace, 1),
    db.catalog.listSchemas(workspace)
  ]);
  const visible: ConformanceViolationDbResult[] = [];
  for (const violation of allViolations.items) {
    if (await canViewViolation(db, workspace, violation, entityAuthCtx)) visible.push(violation);
  }
  const current = visible.filter(
    violation => violation.status === 'active' || violation.status === 'acknowledged'
  );
  const active = current.filter(violation => violation.status === 'active');
  const byCheck = new Map<string, { id: string; name: string; count: number }>();
  const bySchema = new Map<string, { id: string; name: string; count: number }>();
  for (const violation of active) {
    const check = byCheck.get(violation.check_id) ?? {
      id: violation.check_id,
      name: violation.check_name,
      count: 0
    };
    check.count += 1;
    byCheck.set(violation.check_id, check);
    if (violation.schema_id) {
      const schema = schemas.find(candidate => candidate.id === violation.schema_id);
      const item = bySchema.get(violation.schema_id) ?? {
        id: violation.schema_id,
        name: schema?.name ?? violation.schema_id,
        count: 0
      };
      item.count += 1;
      bySchema.set(violation.schema_id, item);
    }
  }
  return {
    active: active.length,
    acknowledged: visible.filter(violation => violation.status === 'acknowledged').length,
    warnings: active.filter(violation => violation.severity === 'warning').length,
    errors: active.filter(violation => violation.severity === 'error').length,
    exempt: visible.filter(violation => violation.status === 'exempt').length,
    resolvedRecently: visible.filter(
      violation =>
        violation.status === 'resolved' &&
        violation.resolved_at != null &&
        violation.resolved_at.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000
    ).length,
    lastRunAt: runs[0]?.completed_at?.toISOString() ?? runs[0]?.started_at.toISOString() ?? null,
    byCheck: [...byCheck.values()].sort((a, b) => b.count - a.count),
    bySchema: [...bySchema.values()].sort((a, b) => b.count - a.count)
  };
};
