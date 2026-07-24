import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from './projectFixtures';
import { createFixtureUser } from './authFixtures';
import type { DatabaseAdapter } from '../database';

const createFixtureTeam = async (db: DatabaseAdapter, workspace: string) => {
  const teamId = randomUUID();
  await db.workspace.replaceTeams(workspace, [
    {
      id: teamId,
      workspace,
      name: `Team ${teamId}`,
      sort_order: 0,
      color: null,
      description: '',
      created_at: new Date()
    }
  ]);
  return teamId;
};

const createFixtureDeprecationCase = async (
  db: DatabaseAdapter,
  workspace: string,
  initiatorUserId: string,
  subjectId = randomUUID()
) =>
  db.governance.createCase({
    id: randomUUID(),
    workspace,
    case_kind: 'entity.deprecation',
    subject_type: 'entity',
    subject_id: subjectId,
    subject_version: null,
    policy_version: 'entity.deprecation:v1',
    initiator_user_id: initiatorUserId,
    parent_case_id: null,
    self_approval_allowed: false,
    payload: {},
    created_at: new Date(),
    due_at: null
  });

runContractSuiteAgainstBothDrivers('Entity deprecation database', getDb => {
  describe('workspace deprecated lifecycle state', () => {
    it('allows marking exactly one lifecycle state as deprecated', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const idA = randomUUID();
      const idB = randomUUID();

      const states = await db.workspace.replaceLifecycleStates(workspace, [
        {
          id: idA,
          workspace,
          label: 'Active',
          color: '#111111',
          sort_order: 0,
          created_at: new Date(),
          is_deprecated_state: false
        },
        {
          id: idB,
          workspace,
          label: 'Deprecated',
          color: '#222222',
          sort_order: 1,
          created_at: new Date(),
          is_deprecated_state: true
        }
      ]);

      expect(states.find(s => s.id === idB)?.is_deprecated_state).toBe(true);
      expect(states.find(s => s.id === idA)?.is_deprecated_state).toBe(false);
    });

    it('rejects marking more than one lifecycle state as deprecated in the same workspace', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      await expect(
        db.workspace.replaceLifecycleStates(workspace, [
          {
            id: randomUUID(),
            workspace,
            label: 'Deprecated A',
            color: '#111111',
            sort_order: 0,
            created_at: new Date(),
            is_deprecated_state: true
          },
          {
            id: randomUUID(),
            workspace,
            label: 'Deprecated B',
            color: '#222222',
            sort_order: 1,
            created_at: new Date(),
            is_deprecated_state: true
          }
        ])
      ).rejects.toThrow();
    });
  });

  describe('one open deprecation case per entity', () => {
    it('rejects a second open deprecation case for the same entity', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const subjectId = randomUUID();

      await createFixtureDeprecationCase(db, workspace, user.id, subjectId);

      await expect(
        createFixtureDeprecationCase(db, workspace, user.id, subjectId)
      ).rejects.toThrow();
    });

    it('allows a new open case once the previous one is cancelled', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const subjectId = randomUUID();

      const first = await createFixtureDeprecationCase(db, workspace, user.id, subjectId);
      await db.governance.cancelCaseIfOpen(first.id, new Date());

      const second = await createFixtureDeprecationCase(db, workspace, user.id, subjectId);
      expect(second.id).not.toBe(first.id);
    });

    it('does not conflict across different case kinds for the same subject', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const subjectId = randomUUID();

      await createFixtureDeprecationCase(db, workspace, user.id, subjectId);
      const other = await db.governance.createCase({
        id: randomUUID(),
        workspace,
        case_kind: 'entity.change-case',
        subject_type: 'entity',
        subject_id: subjectId,
        subject_version: null,
        policy_version: null,
        initiator_user_id: user.id,
        parent_case_id: null,
        self_approval_allowed: false,
        payload: {},
        created_at: new Date(),
        due_at: null
      });
      expect(other.status).toBe('open');
    });
  });

  describe('acknowledgement tasks', () => {
    it('creates, lists and conditionally completes an owner-team acknowledgement', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const teamId = await createFixtureTeam(db, workspace);
      const caseRow = await createFixtureDeprecationCase(db, workspace, user.id);

      const assignment = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'acknowledge',
        target_type: 'team_role',
        target_user_id: null,
        target_team_id: teamId,
        target_team_role: 'team_admin',
        target_capability: null,
        created_at: new Date()
      });

      const ack = await db.entityDeprecation.createAck({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        owner_team_id: teamId,
        assignment_id: assignment.id,
        created_at: new Date()
      });
      expect(ack.status).toBe('open');

      const forCase = await db.entityDeprecation.listAcksForCase(caseRow.id);
      expect(forCase.map(a => a.id)).toEqual([ack.id]);

      const completed = await db.entityDeprecation.completeAckIfOpen(assignment.id, {
        actor_user_id: user.id,
        comment: 'Reviewed, no issues',
        planned_remediation: null,
        remediation_project_id: null,
        target_remediation_date: null,
        risk_accepted: false,
        resolved_at: new Date()
      });
      expect(completed?.status).toBe('completed');
      expect(completed?.actor_user_id).toBe(user.id);
      expect(completed?.comment).toBe('Reviewed, no issues');

      const secondAttempt = await db.entityDeprecation.completeAckIfOpen(assignment.id, {
        actor_user_id: user.id,
        comment: 'second',
        planned_remediation: null,
        remediation_project_id: null,
        target_remediation_date: null,
        risk_accepted: false,
        resolved_at: new Date()
      });
      expect(secondAttempt).toBeNull();

      const byAssignment = await db.entityDeprecation.getAckByAssignment(assignment.id);
      expect(byAssignment?.comment).toBe('Reviewed, no issues');
    });
  });
});
