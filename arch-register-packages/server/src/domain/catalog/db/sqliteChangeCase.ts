import { randomUUID } from 'node:crypto';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  ChangeCaseDatabase,
  ChangeCaseDbCreate,
  ChangeCaseMemberInput
} from './changeCaseDatabase';
import { changeCaseMappers } from './changeCaseDatabase';

export class SqliteChangeCaseDatabase extends SqliteDatabaseBase implements ChangeCaseDatabase {
  async createCase(input: ChangeCaseDbCreate) {
    const caseId = input.id;
    const revisionId = randomUUID();
    this.run(
      `INSERT INTO entity_change_case
       (id, workspace, project_id, status, purpose, name, description, effective_date, milestone_id, initiator_user_id, created_at, updated_at)
       VALUES (?, ?, ?, 'planned', 'planned_change', ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        input.workspace,
        input.project_id,
        input.name,
        input.description,
        input.effective_date,
        input.milestone_id,
        input.created_by,
        input.created_at.toISOString(),
        input.created_at.toISOString()
      ]
    );
    this.run(
      `INSERT INTO entity_change_case_revision
       (id, case_id, workspace, revision_number, message, created_by, status, is_active, created_at, resolved_at)
       VALUES (?, ?, ?, 1, ?, ?, 'draft', 1, ?, NULL)`,
      [revisionId, caseId, input.workspace, input.message, input.created_by, input.created_at.toISOString()]
    );
    for (const member of input.members) {
      this.run(
        `INSERT INTO entity_change_case_entity_version
         (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          revisionId,
          input.workspace,
          member.entity_id,
          member.base_version,
          JSON.stringify(member.base_state),
          JSON.stringify(member.proposed_state),
          JSON.stringify(member.diff)
        ]
      );
    }
    return (await this.getCase(input.workspace, caseId))!;
  }

  async getCase(workspace: string, caseId: string) {
    return this.get(
      'SELECT * FROM entity_change_case WHERE workspace = ? AND id = ?',
      [workspace, caseId],
      changeCaseMappers.case
    );
  }

  async listCasesByProject(workspace: string, projectId: string) {
    return this.all(
      `SELECT * FROM entity_change_case
       WHERE workspace = ? AND project_id = ? AND purpose = 'planned_change'
       ORDER BY updated_at DESC`,
      [workspace, projectId],
      changeCaseMappers.case
    );
  }

  async getActiveRevision(workspace: string, caseId: string) {
    return this.get(
      `SELECT * FROM entity_change_case_revision
       WHERE workspace = ? AND case_id = ? AND is_active = 1
       ORDER BY revision_number DESC LIMIT 1`,
      [workspace, caseId],
      changeCaseMappers.revision
    );
  }

  async getLatestRevision(workspace: string, caseId: string) {
    return this.get(
      `SELECT * FROM entity_change_case_revision
       WHERE workspace = ? AND case_id = ?
       ORDER BY revision_number DESC LIMIT 1`,
      [workspace, caseId],
      changeCaseMappers.revision
    );
  }

  async listMembers(workspace: string, revisionId: string) {
    return this.all(
      `SELECT * FROM entity_change_case_entity_version
       WHERE workspace = ? AND revision_id = ?
       ORDER BY entity_id`,
      [workspace, revisionId],
      changeCaseMappers.member
    );
  }

  async addMember(workspace: string, revisionId: string, member: ChangeCaseMemberInput) {
    const id = randomUUID();
    this.run(
      `INSERT INTO entity_change_case_entity_version
       (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        revisionId,
        workspace,
        member.entity_id,
        member.base_version,
        JSON.stringify(member.base_state),
        JSON.stringify(member.proposed_state),
        JSON.stringify(member.diff)
      ]
    );
    return this.get(
      'SELECT * FROM entity_change_case_entity_version WHERE workspace = ? AND id = ?',
      [workspace, id],
      changeCaseMappers.member
    )!;
  }

  async removeMember(workspace: string, memberId: string) {
    const existing = await this.get(
      'SELECT * FROM entity_change_case_entity_version WHERE workspace = ? AND id = ?',
      [workspace, memberId],
      changeCaseMappers.member
    );
    if (!existing) return null;
    this.run('DELETE FROM entity_change_case_entity_version WHERE workspace = ? AND id = ?', [
      workspace,
      memberId
    ]);
    return existing;
  }

  async updateMemberProposedState(
    workspace: string,
    memberId: string,
    proposedState: Record<string, unknown>,
    diff: Record<string, unknown>
  ) {
    const result = this.run(
      'UPDATE entity_change_case_entity_version SET proposed_state = ?, diff = ? WHERE workspace = ? AND id = ?',
      [JSON.stringify(proposedState), JSON.stringify(diff), workspace, memberId]
    );
    if (result.changes === 0) return null;
    return this.get(
      'SELECT * FROM entity_change_case_entity_version WHERE workspace = ? AND id = ?',
      [workspace, memberId],
      changeCaseMappers.member
    );
  }

  async updateCaseFields(
    workspace: string,
    caseId: string,
    updates: {
      name?: string;
      target_date?: string | null;
      milestone_id?: string | null;
      message?: string | null;
    }
  ) {
    if (updates.name !== undefined) {
      this.run('UPDATE entity_change_case SET name = ? WHERE workspace = ? AND id = ?', [
        updates.name,
        workspace,
        caseId
      ]);
    }
    if (updates.target_date !== undefined || updates.milestone_id !== undefined) {
      this.run(
        'UPDATE entity_change_case SET effective_date = ?, milestone_id = ? WHERE workspace = ? AND id = ?',
        [updates.target_date ?? null, updates.milestone_id ?? null, workspace, caseId]
      );
    }
    if (updates.message !== undefined) {
      this.run(
        'UPDATE entity_change_case_revision SET message = ? WHERE workspace = ? AND case_id = ? AND is_active = 1',
        [updates.message, workspace, caseId]
      );
    }
    return this.getCase(workspace, caseId);
  }

  async markMemberApplied(workspace: string, memberId: string, appliedVersionId: string) {
    this.run(
      'UPDATE entity_change_case_entity_version SET applied_version_id = ? WHERE workspace = ? AND id = ?',
      [appliedVersionId, workspace, memberId]
    );
  }

  async markRevisionApplied(workspace: string, revisionId: string, resolvedAt: Date) {
    this.run(
      "UPDATE entity_change_case_revision SET status = 'applied', is_active = 0, resolved_at = ? WHERE workspace = ? AND id = ?",
      [resolvedAt.toISOString(), workspace, revisionId]
    );
  }

  async markCaseApplied(workspace: string, caseId: string, closedAt: Date) {
    this.run(
      "UPDATE entity_change_case SET status = 'applied', closed_at = ?, updated_at = ? WHERE workspace = ? AND id = ?",
      [closedAt.toISOString(), closedAt.toISOString(), workspace, caseId]
    );
  }

  async withdrawCase(workspace: string, caseId: string) {
    const now = new Date().toISOString();
    this.run(
      "UPDATE entity_change_case_revision SET status = 'withdrawn', is_active = 0, resolved_at = ? WHERE workspace = ? AND case_id = ? AND is_active = 1",
      [now, workspace, caseId]
    );
    const result = this.run(
      "UPDATE entity_change_case SET status = 'withdrawn', closed_at = ?, updated_at = ? WHERE workspace = ? AND id = ?",
      [now, now, workspace, caseId]
    );
    if (result.changes === 0) return null;
    return this.getCase(workspace, caseId);
  }
}
