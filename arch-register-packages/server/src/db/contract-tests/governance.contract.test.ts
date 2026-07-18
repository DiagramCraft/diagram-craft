import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from './projectFixtures';
import { createFixtureUser } from './authFixtures';
import type { DatabaseAdapter } from '../database';

const createFixtureCase = async (
  db: DatabaseAdapter,
  workspace: string,
  initiatorUserId: string,
  overrides: Partial<Parameters<DatabaseAdapter['governance']['createCase']>[0]> = {}
) => {
  const now = new Date();
  return db.governance.createCase({
    id: randomUUID(),
    workspace,
    case_kind: 'test.echo',
    subject_type: 'entity',
    subject_id: randomUUID(),
    subject_version: null,
    policy_version: null,
    initiator_user_id: initiatorUserId,
    parent_case_id: null,
    self_approval_allowed: false,
    payload: {},
    created_at: now,
    due_at: null,
    ...overrides
  });
};

runContractSuiteAgainstBothDrivers('GovernanceDatabase', getDb => {
  describe('cases', () => {
    it('creates, reads, lists and updates a case', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const created = await createFixtureCase(db, workspace, user.id);
      expect(created.status).toBe('open');

      const fetched = await db.governance.getCase(workspace, created.id);
      expect(fetched?.id).toBe(created.id);

      const listed = await db.governance.listCases(workspace, { caseKind: 'test.echo' });
      expect(listed.map(c => c.id)).toContain(created.id);

      const updated = await db.governance.updateCase(created.id, {
        status: 'completed',
        outcome: 'approve',
        completed_at: new Date(),
        cancelled_at: null
      });
      expect(updated.status).toBe('completed');
      expect(updated.outcome).toBe('approve');
    });

    it('completeCaseIfOpen only transitions an open case, and is a no-op afterwards', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const created = await createFixtureCase(db, workspace, user.id);

      const completed = await db.governance.completeCaseIfOpen(created.id, 'approve', new Date());
      expect(completed?.status).toBe('completed');

      const secondAttempt = await db.governance.completeCaseIfOpen(
        created.id,
        'approve',
        new Date()
      );
      expect(secondAttempt).toBeNull();
    });

    it('cancelCaseIfOpen only transitions an open case', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const created = await createFixtureCase(db, workspace, user.id);

      const cancelled = await db.governance.cancelCaseIfOpen(created.id, new Date());
      expect(cancelled?.status).toBe('cancelled');

      const secondAttempt = await db.governance.cancelCaseIfOpen(created.id, new Date());
      expect(secondAttempt).toBeNull();
    });

    it('two concurrent completions of the same case only succeed once', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const created = await createFixtureCase(db, workspace, user.id);

      const [first, second] = await Promise.all([
        db.governance.completeCaseIfOpen(created.id, 'approve', new Date()),
        db.governance.completeCaseIfOpen(created.id, 'reject', new Date())
      ]);

      const outcomes = [first, second].filter(r => r != null);
      expect(outcomes).toHaveLength(1);
    });
  });

  describe('assignments', () => {
    it('creates assignments and lists open ones for a workspace', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const caseRow = await createFixtureCase(db, workspace, user.id);

      const assignment = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'approve',
        target_type: 'user',
        target_user_id: user.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });
      expect(assignment.status).toBe('open');

      const open = await db.governance.listOpenAssignments(workspace);
      expect(open.map(a => a.id)).toContain(assignment.id);

      const forCase = await db.governance.listAssignmentsForCase(caseRow.id);
      expect(forCase).toHaveLength(1);
    });

    it('completeAssignmentIfOpen is conditional and only one of two concurrent decisions wins', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const caseRow = await createFixtureCase(db, workspace, user.id);
      const assignment = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'approve',
        target_type: 'user',
        target_user_id: user.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });

      const [first, second] = await Promise.all([
        db.governance.completeAssignmentIfOpen(assignment.id, new Date()),
        db.governance.completeAssignmentIfOpen(assignment.id, new Date())
      ]);

      const winners = [first, second].filter(r => r != null);
      expect(winners).toHaveLength(1);

      const finalState = await db.governance.getAssignment(assignment.id);
      expect(finalState?.status).toBe('completed');
    });

    it('deciding an already-completed assignment fails predictably', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const caseRow = await createFixtureCase(db, workspace, user.id);
      const assignment = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'approve',
        target_type: 'user',
        target_user_id: user.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });

      await db.governance.completeAssignmentIfOpen(assignment.id, new Date());
      const secondDecision = await db.governance.completeAssignmentIfOpen(
        assignment.id,
        new Date()
      );
      expect(secondDecision).toBeNull();
    });

    it('supersedes sibling open assignments for the same case and action, but not other actions', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const otherUser = await createFixtureUser(db);
      const caseRow = await createFixtureCase(db, workspace, user.id);

      const decided = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'approve',
        target_type: 'user',
        target_user_id: user.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });
      const sibling = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'approve',
        target_type: 'user',
        target_user_id: otherUser.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });
      const unrelatedAction = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'acknowledge',
        target_type: 'user',
        target_user_id: otherUser.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });

      await db.governance.completeAssignmentIfOpen(decided.id, new Date());
      const supersededIds = await db.governance.supersedeOpenSiblingAssignments(
        caseRow.id,
        'approve',
        decided.id,
        new Date()
      );

      expect(supersededIds).toEqual([sibling.id]);
      expect((await db.governance.getAssignment(sibling.id))?.status).toBe('superseded');
      expect((await db.governance.getAssignment(unrelatedAction.id))?.status).toBe('open');
    });

    it('supersedes every open assignment for a case on cancellation', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const caseRow = await createFixtureCase(db, workspace, user.id);
      const approve = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'approve',
        target_type: 'user',
        target_user_id: user.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });
      const acknowledge = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'acknowledge',
        target_type: 'user',
        target_user_id: user.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });

      const supersededIds = await db.governance.supersedeAllOpenAssignmentsForCase(
        caseRow.id,
        new Date()
      );

      expect(supersededIds.sort()).toEqual([approve.id, acknowledge.id].sort());
      expect((await db.governance.getAssignment(approve.id))?.status).toBe('superseded');
      expect((await db.governance.getAssignment(acknowledge.id))?.status).toBe('superseded');
    });
  });

  describe('event history', () => {
    it('is append-only and queryable in chronological order', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const caseRow = await createFixtureCase(db, workspace, user.id);

      const first = await db.governance.appendEvent({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        event_type: 'submitted',
        actor_user_id: user.id,
        occurred_at: new Date(Date.now() - 1000),
        previous_status: null,
        resulting_status: 'open',
        reason: null,
        metadata: {}
      });
      const second = await db.governance.appendEvent({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        event_type: 'approved',
        actor_user_id: user.id,
        occurred_at: new Date(),
        previous_status: 'open',
        resulting_status: 'completed',
        reason: 'looks good',
        metadata: { assignmentId: 'assignment-1' }
      });

      const events = await db.governance.listEvents(caseRow.id);
      expect(events.map(e => e.id)).toEqual([first.id, second.id]);
      expect(events[1]?.reason).toBe('looks good');
      expect(events[1]?.metadata).toEqual({ assignmentId: 'assignment-1' });
    });
  });

  describe('decision idempotency', () => {
    it('records a decision request once and finds it again for the same idempotency key', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const caseRow = await createFixtureCase(db, workspace, user.id);
      const assignment = await db.governance.createAssignment({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        action: 'approve',
        target_type: 'user',
        target_user_id: user.id,
        target_team_id: null,
        target_team_role: null,
        target_capability: null,
        created_at: new Date()
      });
      const decisionEvent = await db.governance.appendEvent({
        id: randomUUID(),
        case_id: caseRow.id,
        workspace,
        event_type: 'approved',
        actor_user_id: user.id,
        occurred_at: new Date(),
        previous_status: 'open',
        resulting_status: 'completed',
        reason: null,
        metadata: {}
      });

      expect(await db.governance.findDecisionRequest(assignment.id, 'req-1')).toBeNull();

      await db.governance.recordDecisionRequest(
        assignment.id,
        'req-1',
        decisionEvent.id,
        new Date()
      );

      const found = await db.governance.findDecisionRequest(assignment.id, 'req-1');
      expect(found).toEqual({ eventId: decisionEvent.id });
    });
  });

  describe('transactional atomicity', () => {
    it('rolls back a case and its event together when the transaction throws', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const caseId = randomUUID();

      await expect(
        db.core.transaction(async tx => {
          const created = await tx.governance.createCase({
            id: caseId,
            workspace,
            case_kind: 'test.echo',
            subject_type: 'entity',
            subject_id: randomUUID(),
            subject_version: null,
            policy_version: null,
            initiator_user_id: user.id,
            parent_case_id: null,
            self_approval_allowed: false,
            payload: {},
            created_at: new Date(),
            due_at: null
          });
          await tx.governance.appendEvent({
            id: randomUUID(),
            case_id: created.id,
            workspace,
            event_type: 'submitted',
            actor_user_id: user.id,
            occurred_at: new Date(),
            previous_status: null,
            resulting_status: 'open',
            reason: null,
            metadata: {}
          });
          throw new Error('simulated failure after writes');
        })
      ).rejects.toThrow('simulated failure after writes');

      expect(await db.governance.getCase(workspace, caseId)).toBeNull();
    });
  });
});
