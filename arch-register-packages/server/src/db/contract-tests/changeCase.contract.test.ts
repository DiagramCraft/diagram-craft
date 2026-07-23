import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureProject,
  createFixtureSchema,
  createFixtureWorkspace
} from './projectFixtures';
import { createFixtureCatalogEntity } from './catalogFixtures';

runContractSuiteAgainstBothDrivers('ChangeCaseDatabase', getDb => {
  const setup = async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createFixtureSchema(db, workspace);
    const project = await createFixtureProject(db, workspace);
    const entityA = await createFixtureCatalogEntity(db, workspace, schema);
    const entityB = await createFixtureCatalogEntity(db, workspace, schema);
    return { db, workspace, project, entityA, entityB };
  };

  const member = (entityId: string, overrides: Partial<{ base_version: number }> = {}) => ({
    entity_id: entityId,
    base_version: overrides.base_version ?? 1,
    base_state: { id: entityId },
    proposed_state: { id: entityId, name: 'renamed' },
    diff: {}
  });

  it('creates a case with multiple members in one revision', async () => {
    const { db, workspace, project, entityA, entityB } = await setup();

    const created = await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'Split the service',
      description: null,
      effective_date: '2026-09-01',
      milestone_id: null,
      message: 'Splitting into two services',
      created_by: null,
      created_at: new Date(),
      members: [member(entityA.id), member(entityB.id)]
    });

    expect(created.status).toBe('planned');
    expect(created.purpose).toBe('planned_change');

    const revision = await db.changeCase.getActiveRevision(workspace, created.id);
    expect(revision).not.toBeNull();
    expect(revision!.revision_number).toBe(1);

    const members = await db.changeCase.listMembers(workspace, revision!.id);
    expect(members).toHaveLength(2);
    expect(new Set(members.map(m => m.entity_id))).toEqual(new Set([entityA.id, entityB.id]));
  });

  it('supports adding an entity to an existing not-yet-applied case', async () => {
    const { db, workspace, project, entityA, entityB } = await setup();

    const created = await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: null,
      description: null,
      effective_date: '2026-09-01',
      milestone_id: null,
      message: null,
      created_by: null,
      created_at: new Date(),
      members: [member(entityA.id)]
    });

    const revision = await db.changeCase.getActiveRevision(workspace, created.id);
    await db.changeCase.addMember(workspace, revision!.id, member(entityB.id));

    const members = await db.changeCase.listMembers(workspace, revision!.id);
    expect(members).toHaveLength(2);
  });

  it('applies every member atomically and records the applied version on each', async () => {
    const { db, workspace, project, entityA, entityB } = await setup();
    const entityAVersion = entityA.version ?? 1;
    const entityBVersion = entityB.version ?? 1;

    const created = await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: null,
      description: null,
      effective_date: '2026-09-01',
      milestone_id: null,
      message: null,
      created_by: null,
      created_at: new Date(),
      members: [
        member(entityA.id, { base_version: entityAVersion }),
        member(entityB.id, { base_version: entityBVersion })
      ]
    });
    const revision = await db.changeCase.getActiveRevision(workspace, created.id);
    const members = await db.changeCase.listMembers(workspace, revision!.id);

    const appliedAt = new Date();
    const appliedVersionIds = new Map<string, string>();
    for (const m of members) {
      const versionId = randomUUID();
      await db.catalog.createEntityVersion({
        id: versionId,
        workspace,
        entity_id: m.entity_id,
        version_number: (m.entity_id === entityA.id ? entityAVersion : entityBVersion) + 1,
        kind: 'case_applied',
        commit_message: null,
        created_at: appliedAt,
        created_by: null,
        state: m.proposed_state,
        applied_case_revision_id: revision!.id
      });
      appliedVersionIds.set(m.id, versionId);
      await db.changeCase.markMemberApplied(workspace, m.id, versionId);
    }
    await db.changeCase.markRevisionApplied(workspace, revision!.id, appliedAt);
    await db.changeCase.markCaseApplied(workspace, created.id, appliedAt);

    const appliedCase = await db.changeCase.getCase(workspace, created.id);
    expect(appliedCase!.status).toBe('applied');

    // The active revision is no longer active once applied — reads must fall back to
    // getLatestRevision, matching what toApiChangeCase does for already-applied cases.
    expect(await db.changeCase.getActiveRevision(workspace, created.id)).toBeNull();
    const latestRevision = await db.changeCase.getLatestRevision(workspace, created.id);
    expect(latestRevision!.status).toBe('applied');

    const appliedMembers = await db.changeCase.listMembers(workspace, latestRevision!.id);
    for (const m of appliedMembers) {
      expect(m.applied_version_id).toBe(appliedVersionIds.get(m.id));
    }
  });

  it('removes a member and can withdraw a not-yet-applied case', async () => {
    const { db, workspace, project, entityA, entityB } = await setup();

    const created = await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: null,
      description: null,
      effective_date: '2026-09-01',
      milestone_id: null,
      message: null,
      created_by: null,
      created_at: new Date(),
      members: [member(entityA.id), member(entityB.id)]
    });
    const revision = await db.changeCase.getActiveRevision(workspace, created.id);
    const members = await db.changeCase.listMembers(workspace, revision!.id);

    const removed = await db.changeCase.removeMember(workspace, members[0]!.id);
    expect(removed?.id).toBe(members[0]!.id);
    expect(await db.changeCase.listMembers(workspace, revision!.id)).toHaveLength(1);

    const withdrawn = await db.changeCase.withdrawCase(workspace, created.id);
    expect(withdrawn!.status).toBe('withdrawn');
    expect(await db.changeCase.getActiveRevision(workspace, created.id)).toBeNull();
  });

  it('lists cases for a project, most recently updated first', async () => {
    const { db, workspace, project, entityA } = await setup();

    const first = await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'First',
      description: null,
      effective_date: '2026-09-01',
      milestone_id: null,
      message: null,
      created_by: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      members: [member(entityA.id)]
    });
    const second = await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'Second',
      description: null,
      effective_date: '2026-09-01',
      milestone_id: null,
      message: null,
      created_by: null,
      created_at: new Date('2026-02-01T00:00:00Z'),
      members: [member(entityA.id)]
    });

    const cases = await db.changeCase.listCasesByProject(workspace, project.id);
    expect(cases.map(c => c.id)).toEqual([second.id, first.id]);
  });

  describe('updateCaseFields', () => {
    it('updates the shared target date and commit message on the active revision', async () => {
      const { db, workspace, project, entityA } = await setup();

      const created = await db.changeCase.createCase({
        id: randomUUID(),
        workspace,
        project_id: project.id,
        name: null,
        description: null,
        effective_date: '2026-09-01',
        milestone_id: null,
        message: 'original message',
        created_by: null,
        created_at: new Date(),
        members: [member(entityA.id)]
      });

      const updated = await db.changeCase.updateCaseFields(workspace, created.id, {
        target_date: '2026-10-15',
        milestone_id: null,
        message: 'updated message'
      });
      expect(updated!.effective_date).toBe('2026-10-15');

      const revision = await db.changeCase.getActiveRevision(workspace, created.id);
      expect(revision!.message).toBe('updated message');
    });
  });
});
