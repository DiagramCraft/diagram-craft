import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from '../testSupport/fixtures';

runContractSuiteAgainstBothDrivers('BaselineDatabase', getDb => {
  it('persists immutable record payloads and lifecycle metadata', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const now = new Date();
    const firstId = randomUUID();
    const secondId = randomUUID();

    await db.baseline.createBaseline({
      id: firstId,
      workspace,
      name: 'Current catalog',
      description: 'Approval reference',
      owner_team_id: null,
      created_by: 'user-1',
      effective_at: now,
      scope: { kind: 'workspace' },
      query: null,
      include_planned_changes: true,
      include_overdue_changes: false,
      created_at: now,
      entity_count: 1,
      relation_count: 1
    });
    await db.baseline.insertBaselineRecords([
      {
        workspace,
        baseline_id: firstId,
        record_kind: 'entity',
        record_id: 'entity-1',
        state: { id: 'entity-1', name: 'Captured' },
        schema: { id: 'schema-1', name: 'Application' },
        state_hash: 'entity-hash',
        position: 0
      },
      {
        workspace,
        baseline_id: firstId,
        record_kind: 'relation',
        record_id: 'relation-1',
        state: { id: 'relation-1', data: { criticality: 'high' } },
        schema: { id: 'relation-schema-1', name: 'Depends on' },
        state_hash: 'relation-hash',
        position: 0
      }
    ]);

    const records = await db.baseline.listBaselineRecords(workspace, firstId);
    expect(records.map(record => record.record_kind)).toEqual(['entity', 'relation']);
    expect(records[0]!.state).toEqual({ id: 'entity-1', name: 'Captured' });
    expect((await db.baseline.listBaselines(workspace))).toHaveLength(1);

    const link = await db.baseline.createBaselineLink({
      workspace,
      baseline_id: firstId,
      target_type: 'project',
      target_id: 'project-1',
      created_by: 'user-1',
      created_at: now
    });
    expect(link.target_type).toBe('project');
    expect(await db.baseline.listBaselineLinks(workspace, firstId)).toEqual([link]);
    expect(await db.baseline.deleteBaselineLink(workspace, firstId, link.id)).toEqual(link);
    expect(await db.baseline.listBaselineLinks(workspace, firstId)).toEqual([]);

    await db.baseline.createBaseline({
      id: secondId,
      workspace,
      name: 'Replacement',
      description: null,
      owner_team_id: null,
      created_by: 'user-1',
      effective_at: now,
      scope: { kind: 'workspace' },
      query: null,
      include_planned_changes: false,
      include_overdue_changes: false,
      created_at: now,
      entity_count: 0,
      relation_count: 0
    });
    const superseded = await db.baseline.setSupersededBy(workspace, firstId, secondId);
    expect(superseded?.superseded_by_id).toBe(secondId);

    const deleted = await db.baseline.softDelete(workspace, secondId, 'user-1', now);
    expect(deleted?.deleted_at).toEqual(now);
    expect(await db.baseline.getBaseline(workspace, secondId)).toBeNull();
    expect(await db.baseline.getBaseline(workspace, secondId, true)).not.toBeNull();
    expect(await db.baseline.listBaselineRecords(workspace, firstId)).toHaveLength(2);
  });
});
