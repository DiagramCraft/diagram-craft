import { randomUUID } from 'node:crypto';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { PostgresDatabaseBase, normalizePostgresError } from '../../../db/postgresBase';
import type {
  ChangeCaseDatabase,
  ChangeCaseDbCreate,
  ChangeCaseMemberInput
} from './changeCaseDatabase';
import { changeCaseMappers } from './changeCaseDatabase';

export class PostgresChangeCaseDatabase
  extends PostgresDatabaseBase
  implements ChangeCaseDatabase
{
  async createCase(input: ChangeCaseDbCreate) {
    try {
      const caseId = input.id;
      const revisionId = randomUUID();
      await this.sql`
        INSERT INTO entity_change_case (id, workspace, project_id, status, purpose, name, description, effective_date, milestone_id, initiator_user_id, created_at, updated_at)
        VALUES (${caseId}, ${input.workspace}, ${input.project_id}, 'planned', 'planned_change', ${input.name}, ${input.description}, ${input.effective_date}, ${input.milestone_id}, ${input.created_by}, ${input.created_at}, ${input.created_at})
      `;
      await this.sql`
        INSERT INTO entity_change_case_revision (id, case_id, workspace, revision_number, message, created_by, status, is_active, created_at, resolved_at)
        VALUES (${revisionId}, ${caseId}, ${input.workspace}, 1, ${input.message}, ${input.created_by}, 'draft', TRUE, ${input.created_at}, NULL)
      `;
      for (const member of input.members) {
        await this.sql`
          INSERT INTO entity_change_case_entity_version (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff)
          VALUES (${randomUUID()}, ${revisionId}, ${input.workspace}, ${member.entity_id}, ${member.base_version}, ${this.json(member.base_state)}, ${this.json(member.proposed_state)}, ${this.json(member.diff)})
        `;
      }
      return (await this.getCase(input.workspace, caseId))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getCase(workspace: string, caseId: string) {
    const rows = await this
      .sql`SELECT * FROM entity_change_case WHERE workspace = ${workspace} AND id = ${caseId}`;
    return rows[0] ? changeCaseMappers.case(rows[0] as DatabaseRow) : null;
  }

  async listCasesByProject(workspace: string, projectId: string) {
    const rows = await this.sql`
      SELECT * FROM entity_change_case
      WHERE workspace = ${workspace} AND project_id = ${projectId} AND purpose = 'planned_change'
      ORDER BY updated_at DESC
    `;
    return mapDatabaseRows(rows as DatabaseRow[], changeCaseMappers.case);
  }

  async getActiveRevision(workspace: string, caseId: string) {
    const rows = await this.sql`
      SELECT * FROM entity_change_case_revision
      WHERE workspace = ${workspace} AND case_id = ${caseId} AND is_active = TRUE
      ORDER BY revision_number DESC LIMIT 1
    `;
    return rows[0] ? changeCaseMappers.revision(rows[0] as DatabaseRow) : null;
  }

  async getLatestRevision(workspace: string, caseId: string) {
    const rows = await this.sql`
      SELECT * FROM entity_change_case_revision
      WHERE workspace = ${workspace} AND case_id = ${caseId}
      ORDER BY revision_number DESC LIMIT 1
    `;
    return rows[0] ? changeCaseMappers.revision(rows[0] as DatabaseRow) : null;
  }

  async listMembers(workspace: string, revisionId: string) {
    const rows = await this.sql`
      SELECT * FROM entity_change_case_entity_version
      WHERE workspace = ${workspace} AND revision_id = ${revisionId}
      ORDER BY entity_id
    `;
    return mapDatabaseRows(rows as DatabaseRow[], changeCaseMappers.member);
  }

  async addMember(workspace: string, revisionId: string, member: ChangeCaseMemberInput) {
    try {
      const id = randomUUID();
      await this.sql`
        INSERT INTO entity_change_case_entity_version (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff)
        VALUES (${id}, ${revisionId}, ${workspace}, ${member.entity_id}, ${member.base_version}, ${this.json(member.base_state)}, ${this.json(member.proposed_state)}, ${this.json(member.diff)})
      `;
      const rows = await this
        .sql`SELECT * FROM entity_change_case_entity_version WHERE workspace = ${workspace} AND id = ${id}`;
      return changeCaseMappers.member(rows[0] as DatabaseRow);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async removeMember(workspace: string, memberId: string) {
    const rows = await this.sql`
      DELETE FROM entity_change_case_entity_version
      WHERE workspace = ${workspace} AND id = ${memberId}
      RETURNING *
    `;
    return rows[0] ? changeCaseMappers.member(rows[0] as DatabaseRow) : null;
  }

  async updateMemberProposedState(
    workspace: string,
    memberId: string,
    proposedState: Record<string, unknown>,
    diff: Record<string, unknown>
  ) {
    const rows = await this.sql`
      UPDATE entity_change_case_entity_version
      SET proposed_state = ${this.json(proposedState)}, diff = ${this.json(diff)}
      WHERE workspace = ${workspace} AND id = ${memberId}
      RETURNING *
    `;
    return rows[0] ? changeCaseMappers.member(rows[0] as DatabaseRow) : null;
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
      await this.sql`
        UPDATE entity_change_case
        SET name = ${updates.name}
        WHERE workspace = ${workspace} AND id = ${caseId}
      `;
    }
    if (updates.target_date !== undefined || updates.milestone_id !== undefined) {
      await this.sql`
        UPDATE entity_change_case
        SET effective_date = ${updates.target_date ?? null}, milestone_id = ${updates.milestone_id ?? null}
        WHERE workspace = ${workspace} AND id = ${caseId}
      `;
    }
    if (updates.message !== undefined) {
      await this.sql`
        UPDATE entity_change_case_revision
        SET message = ${updates.message}
        WHERE workspace = ${workspace} AND case_id = ${caseId} AND is_active = TRUE
      `;
    }
    return this.getCase(workspace, caseId);
  }

  async markMemberApplied(workspace: string, memberId: string, appliedVersionId: string) {
    await this.sql`
      UPDATE entity_change_case_entity_version
      SET applied_version_id = ${appliedVersionId}
      WHERE workspace = ${workspace} AND id = ${memberId}
    `;
  }

  async markRevisionApplied(workspace: string, revisionId: string, resolvedAt: Date) {
    await this.sql`
      UPDATE entity_change_case_revision
      SET status = 'applied', is_active = FALSE, resolved_at = ${resolvedAt}
      WHERE workspace = ${workspace} AND id = ${revisionId}
    `;
  }

  async markCaseApplied(workspace: string, caseId: string, closedAt: Date) {
    await this.sql`
      UPDATE entity_change_case
      SET status = 'applied', closed_at = ${closedAt}, updated_at = ${closedAt}
      WHERE workspace = ${workspace} AND id = ${caseId}
    `;
  }

  async withdrawCase(workspace: string, caseId: string) {
    const now = new Date();
    await this.sql`
      UPDATE entity_change_case_revision
      SET status = 'withdrawn', is_active = FALSE, resolved_at = ${now}
      WHERE workspace = ${workspace} AND case_id = ${caseId} AND is_active = TRUE
    `;
    const rows = await this.sql`
      UPDATE entity_change_case
      SET status = 'withdrawn', closed_at = ${now}, updated_at = ${now}
      WHERE workspace = ${workspace} AND id = ${caseId}
      RETURNING *
    `;
    return rows[0] ? changeCaseMappers.case(rows[0] as DatabaseRow) : null;
  }
}
