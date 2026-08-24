import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type {
  EntityConformanceStatusFilter,
  EntityConformanceStatus
} from '@arch-register/api-types/conformanceContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureSchema,
  createFixtureUser,
  createFixtureWorkspace
} from '../testSupport/fixtures';
import type { ConformanceCheckDbCreate } from '../../domain/conformance/db/conformanceDatabase';
import { executeConformanceRun } from '../../domain/conformance/conformanceEvaluation';
import { listEntitiesWithCount } from '../../domain/catalog/entityQueryOperations';

const statusQuery = (status: EntityConformanceStatusFilter): EntityQuery => ({
  root: { kind: 'predicate', path: [], fieldId: '_conformanceStatus', op: 'equals', value: status }
});

const createScheduledCheck = async (
  db: Parameters<typeof listEntitiesWithCount>[0],
  workspace: string,
  schemaId: string,
  name: string
) => {
  const now = new Date();
  const check: ConformanceCheckDbCreate = {
    id: randomUUID(),
    workspace,
    name,
    description: null,
    severity: 'error',
    enabled: true,
    definition: {
      type: 'scheduled_validation',
      schemaId,
      expression: 'true',
      message: `${name} failed`
    },
    revision: 1,
    created_by: null,
    created_at: now,
    updated_at: now
  };
  await db.conformance.createCheck(check);
  return check;
};

runContractSuiteAgainstBothDrivers('Conformance status in entity queries', getDb => {
  it('projects, aggregates, filters, and marks stale coverage', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schemaId = await createFixtureSchema(db, workspace, { name: 'Service' });
    const otherSchemaId = await createFixtureSchema(db, workspace, { name: 'Unscoped' });
    const conformant = await createFixtureEntity(db, workspace, schemaId, { name: 'Conformant' });
    const violating = await createFixtureEntity(db, workspace, schemaId, { name: 'Violating' });
    const acknowledged = await createFixtureEntity(db, workspace, schemaId, {
      name: 'Acknowledged'
    });
    const exempt = await createFixtureEntity(db, workspace, schemaId, { name: 'Exempt' });
    const stale = await createFixtureEntity(db, workspace, schemaId, { name: 'Stale' });
    await createFixtureEntity(db, workspace, otherSchemaId, {
      name: 'Not evaluated'
    });

    const checks = await Promise.all(
      ['Rule 1', 'Rule 2', 'Rule 3'].map(name =>
        createScheduledCheck(db, workspace, schemaId, name)
      )
    );
    const run = await db.conformance.createRun({
      id: randomUUID(),
      workspace,
      check_id: checks[0]!.id,
      job_run_id: null,
      status: 'running',
      started_at: new Date(),
      completed_at: null,
      checked_count: 0,
      violation_count: 0,
      error: null,
      configuration: {}
    });
    await executeConformanceRun(db, workspace, run.id, checks[0]!.id);
    const now = new Date();
    const old = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const evaluatedEntities = [conformant, violating, acknowledged, exempt, stale];
    for (const check of checks.slice(1)) {
      await db.conformance.recordEntityEvaluations(
        evaluatedEntities.map(entity => ({
          workspace,
          check_id: check.id,
          entity_id: entity.id,
          check_revision: check.revision,
          run_id: null,
          evaluated_at: entity.id === stale.id ? old : now
        }))
      );
    }

    await db.conformance.upsertViolation({
      id: randomUUID(),
      workspace,
      check_id: checks[0]!.id,
      entity_id: violating.id,
      entity_name: violating.name,
      schema_id: schemaId,
      severity: 'error',
      message: 'Active violation',
      evidence: {},
      run_id: null,
      seen_at: now
    });
    const acknowledgedViolation = await db.conformance.upsertViolation({
      id: randomUUID(),
      workspace,
      check_id: checks[1]!.id,
      entity_id: acknowledged.id,
      entity_name: acknowledged.name,
      schema_id: schemaId,
      severity: 'error',
      message: 'Acknowledged violation',
      evidence: {},
      run_id: null,
      seen_at: now
    });
    await db.conformance.setViolationStatus(
      workspace,
      acknowledgedViolation.id,
      'acknowledged',
      now,
      {}
    );
    const exemptViolation = await db.conformance.upsertViolation({
      id: randomUUID(),
      workspace,
      check_id: checks[2]!.id,
      entity_id: exempt.id,
      entity_name: exempt.name,
      schema_id: schemaId,
      severity: 'error',
      message: 'Exempt violation',
      evidence: {},
      run_id: null,
      seen_at: now
    });
    await db.conformance.createExemption({
      id: randomUUID(),
      workspace,
      violation_id: exemptViolation.id,
      reason: 'Accepted risk',
      expires_at: null,
      created_by: null,
      created_at: now,
      revoked_at: null
    });

    const page = await listEntitiesWithCount(db, workspace, null, {
      entityQuery: { root: { kind: 'and', children: [] } },
      view: 'summary',
      limit: null,
      offset: 0
    });
    const statusByName = Object.fromEntries(
      page.items.map(entity => [entity._name, entity._conformanceStatus] as const)
    );
    expect(statusByName).toMatchObject({
      Conformant: 'conformant',
      Violating: 'violating',
      Acknowledged: 'acknowledged',
      Exempt: 'exempt',
      Stale: 'conformant',
      'Not evaluated': 'not_evaluated'
    });
    expect(page.items.find(entity => entity._name === 'Stale')?._conformanceStale).toBe(true);
    expect(
      page.items.find(entity => entity._name === 'Not evaluated')?._conformanceEvaluatedAt
    ).toBe(null);

    const queryStatuses: [EntityConformanceStatusFilter, EntityConformanceStatus][] = [
      ['conformant', 'conformant'],
      ['violating', 'violating'],
      ['acknowledged', 'acknowledged'],
      ['exempt', 'exempt'],
      ['not_evaluated', 'not_evaluated']
    ];
    for (const [filter, expected] of queryStatuses) {
      const result = await listEntitiesWithCount(db, workspace, null, {
        entityQuery: statusQuery(filter),
        view: 'summary'
      });
      expect(result.items.every(entity => entity._conformanceStatus === expected)).toBe(true);
      expect(result.total).toBe(result.items.length);
    }

    const unresolved = await listEntitiesWithCount(db, workspace, null, {
      entityQuery: statusQuery('unresolved'),
      view: 'summary'
    });
    expect(unresolved.items.map(entity => entity._name).sort()).toEqual([
      'Acknowledged',
      'Violating'
    ]);

    const count = await listEntitiesWithCount(db, workspace, null, {
      entityQuery: statusQuery('violating'),
      view: 'summary',
      limit: 1,
      offset: 0
    });
    expect(count.total).toBe(1);
    expect(count.items).toHaveLength(1);
    expect(count.items[0]?._uid).toBe(violating.id);
  });

  it('does not expose hidden entities through status filters', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const schemaId = await createFixtureSchema(db, workspace);
    const visible = await createFixtureEntity(db, workspace, schemaId, { name: 'Visible' });
    const hidden = await createFixtureEntity(db, workspace, schemaId, { name: 'Hidden' });
    const schema = (await db.catalog.getSchema(workspace, schemaId))!;
    const grants = await db.catalog.replaceEntityGrants(workspace, visible.id, [
      {
        id: randomUUID(),
        workspace,
        entity_id: visible.id,
        principal_type: 'user',
        principal_id: user.id,
        role: 'editor',
        applies_to: 'self',
        created_at: new Date()
      }
    ]);
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      schemas: [schema],
      entities: [visible],
      grants
    });
    const check = await createScheduledCheck(db, workspace, schemaId, 'Hidden rule');
    await db.conformance.upsertViolation({
      id: randomUUID(),
      workspace,
      check_id: check.id,
      entity_id: hidden.id,
      entity_name: hidden.name,
      schema_id: schemaId,
      severity: 'error',
      message: 'Hidden violation',
      evidence: { secret: true },
      run_id: null,
      seen_at: new Date()
    });

    const visiblePage = await listEntitiesWithCount(db, workspace, authCtx, {
      entityQuery: { root: { kind: 'and', children: [] } },
      view: 'summary'
    });
    expect(visiblePage.total).toBe(1);
    expect(visiblePage.items[0]?._uid).toBe(visible.id);
    expect(visiblePage.items[0]?._conformanceStatus).toBe('not_evaluated');

    const violatingPage = await listEntitiesWithCount(db, workspace, authCtx, {
      entityQuery: statusQuery('violating'),
      view: 'summary'
    });
    expect(violatingPage.total).toBe(0);
    expect(violatingPage.items).toHaveLength(0);
  });
});
