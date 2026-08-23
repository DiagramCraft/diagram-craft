import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { ConformanceCheckDbCreate } from '../../domain/conformance/db/conformanceDatabase';
import {
  CONFORMANCE_VIOLATION_CASE_KIND,
  ensureConformanceGovernanceCase
} from '../../domain/conformance/conformanceGovernance';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureSchema,
  createFixtureUser,
  createFixtureWorkspace
} from '../testSupport/fixtures';

runContractSuiteAgainstBothDrivers('ConformanceDatabase', getDb => {
  it('persists run-linked violations, transitions, and exemptions', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const schema = await createFixtureSchema(db, workspace);
    const entity = await createFixtureEntity(db, workspace, schema, { name: 'Server' });
    const now = new Date();
    const check: ConformanceCheckDbCreate = {
      id: randomUUID(),
      workspace,
      name: 'Server policy',
      description: null,
      severity: 'error',
      enabled: true,
      definition: {
        type: 'query_policy',
        query: { root: { kind: 'and', children: [] } },
        message: 'Server policy failed',
        governance: { enabled: true, resolution: 'acknowledge' }
      },
      revision: 1,
      created_by: user.id,
      created_at: now,
      updated_at: now
    };
    await db.conformance.createCheck(check);
    const run = await db.conformance.createRun({
      id: randomUUID(),
      workspace,
      check_id: check.id,
      job_run_id: null,
      status: 'running',
      started_at: now,
      completed_at: null,
      checked_count: 1,
      violation_count: 1,
      error: null,
      configuration: {}
    });

    const violation = await db.conformance.upsertViolation({
      id: randomUUID(),
      workspace,
      check_id: check.id,
      entity_id: entity.id,
      entity_name: entity.name,
      schema_id: schema,
      severity: 'error',
      message: 'Server policy failed',
      evidence: { type: 'query_policy' },
      run_id: run.id,
      seen_at: now
    });

    expect(violation).toMatchObject({
      entity_id: entity.id,
      schema_id: schema,
      source_type: 'query_policy',
      status: 'active'
    });
    await ensureConformanceGovernanceCase(db, check, violation, now);
    expect(
      await db.governance.getCaseByDedupeKey(
        workspace,
        CONFORMANCE_VIOLATION_CASE_KIND,
        `conformance:${violation.id}`
      )
    ).toMatchObject({ subject_id: violation.id, case_kind: CONFORMANCE_VIOLATION_CASE_KIND });
    expect(
      (
        await db.conformance.listViolations(workspace, {
          schema_id: schema,
          status: 'active',
          limit: 10,
          offset: 0
        })
      ).total
    ).toBe(1);

    await db.conformance.setViolationStatus(workspace, violation.id, 'acknowledged', now, {
      source: 'test'
    });
    expect((await db.conformance.getViolation(workspace, violation.id))?.status).toBe(
      'acknowledged'
    );

    const exemption = await db.conformance.createExemption({
      id: randomUUID(),
      workspace,
      violation_id: violation.id,
      reason: 'Accepted for the release window',
      expires_at: new Date(now.getTime() + 60_000),
      created_by: user.id,
      created_at: now,
      revoked_at: null
    });
    expect(exemption.reason).toBe('Accepted for the release window');
    expect((await db.conformance.getViolation(workspace, violation.id))?.status).toBe('exempt');

    // An exempted violation must drop out of the 'active' filter and appear under 'exempt' —
    // exempting a violation doesn't rewrite its persisted status, only its effective one.
    expect(
      (
        await db.conformance.listViolations(workspace, {
          schema_id: schema,
          status: 'active',
          limit: 10,
          offset: 0
        })
      ).total
    ).toBe(0);
    expect(
      (
        await db.conformance.listViolations(workspace, {
          schema_id: schema,
          status: 'exempt',
          limit: 10,
          offset: 0
        })
      ).total
    ).toBe(1);

    const resolved = await db.conformance.resolveUnseenViolations(
      workspace,
      check.id,
      [],
      new Date(now.getTime() + 1_000),
      run.id
    );
    expect(resolved).toEqual([violation.id]);
    expect((await db.conformance.getViolation(workspace, violation.id))?.status).toBe('resolved');
  });
});
