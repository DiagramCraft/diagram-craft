import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceAdminDatabase
} from './database.js';
import type { TeamMembership, WorkspaceMember, WorkspaceLifecycleState, WorkspaceOwner, WorkspaceRole } from '../types.js';
import { SqliteDatabaseBase, sqliteMappers } from './sqliteBase.js';

export class SqliteWorkspaceAdminDatabase
  extends SqliteDatabaseBase
  implements WorkspaceAdminDatabase
{
  async listWorkspaces() {
    return this.all('SELECT * FROM workspace ORDER BY name', [], sqliteMappers.workspace);
  }

  async getWorkspace(id: string) {
    return this.get('SELECT * FROM workspace WHERE id = ?', [id], sqliteMappers.workspace);
  }

  async createWorkspace(input: CreateWorkspaceInput) {
    this.run(
      'INSERT INTO workspace (id, name, url_slug, short_code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.name,
        input.url_slug,
        input.short_code,
        input.description,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getWorkspace(input.id))!;
  }

  async updateWorkspace(id: string, input: UpdateWorkspaceInput) {
    this.run(
      'UPDATE workspace SET name = ?, url_slug = ?, short_code = ?, description = ?, updated_at = ? WHERE id = ?',
      [
        input.name,
        input.url_slug,
        input.short_code,
        input.description,
        input.updated_at.toISOString(),
        id
      ]
    );
    return await this.getWorkspace(id);
  }

  async deleteWorkspace(id: string) {
    const workspace = await this.getWorkspace(id);
    if (!workspace) return { workspace: null, projectIds: [] };

    const projectIds = this.all<{ id: string }>(
      'SELECT id FROM project WHERE workspace = ?',
      [id]
    ).map(project => project.id);

    const tx = this.db.transaction((workspaceId: string) => {
      this.run('DELETE FROM project_file WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM project WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM entity_grant WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM entity WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM entity_schema WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM workspace_member WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM team_membership WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM workspace_lifecycle_state WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM workspace_owner WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM audit_log WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM workspace WHERE id = ?', [workspaceId]);
    });

    tx(id);
    return { workspace, projectIds };
  }

  async listLifecycleStates(workspace: string) {
    return this.all(
      'SELECT id, workspace, label, color, sort_order, created_at FROM workspace_lifecycle_state WHERE workspace = ? ORDER BY sort_order, id',
      [workspace],
      sqliteMappers.lifecycleState
    );
  }

  async replaceLifecycleStates(workspace: string, states: WorkspaceLifecycleState[]) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM workspace_lifecycle_state WHERE workspace = ?', [workspace]);
      for (const state of states) {
        this.run(
          'INSERT INTO workspace_lifecycle_state (id, workspace, label, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            state.id,
            workspace,
            state.label,
            state.color,
            state.sort_order,
            state.created_at.toISOString()
          ]
        );
      }
    });

    tx();
    return await this.listLifecycleStates(workspace);
  }

  async listOwners(workspace: string) {
    return this.all(
      'SELECT id, workspace, sort_order, created_at FROM workspace_owner WHERE workspace = ? ORDER BY sort_order, id',
      [workspace],
      sqliteMappers.owner
    );
  }

  async replaceOwners(workspace: string, owners: WorkspaceOwner[]) {
    const tx = this.db.transaction(() => {
      const ownerIds = owners.map(owner => owner.id);

      if (ownerIds.length === 0) {
        this.run('DELETE FROM team_membership WHERE workspace = ?', [workspace]);
        this.run('DELETE FROM workspace_owner WHERE workspace = ?', [workspace]);
        return;
      }

      const placeholders = ownerIds.map(() => '?').join(', ');
      this.run(
        `DELETE FROM team_membership WHERE workspace = ? AND team_id NOT IN (${placeholders})`,
        [workspace, ...ownerIds]
      );
      this.run(
        `DELETE FROM workspace_owner WHERE workspace = ? AND id NOT IN (${placeholders})`,
        [workspace, ...ownerIds]
      );

      for (const owner of owners) {
        this.run(
          `INSERT INTO workspace_owner (id, workspace, sort_order, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(workspace, id) DO UPDATE SET
             sort_order = excluded.sort_order,
             created_at = excluded.created_at`,
          [owner.id, workspace, owner.sort_order, owner.created_at.toISOString()]
        );
      }
    });

    tx();
    return await this.listOwners(workspace);
  }

  async listTeamMemberships(workspace: string) {
    return this.all(
      'SELECT workspace, team_id, user_id, created_at FROM team_membership WHERE workspace = ? ORDER BY team_id, user_id',
      [workspace],
      sqliteMappers.teamMembership
    );
  }

  async replaceTeamMemberships(workspace: string, memberships: TeamMembership[]) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM team_membership WHERE workspace = ?', [workspace]);
      for (const membership of memberships) {
        this.run(
          'INSERT INTO team_membership (workspace, team_id, user_id, created_at) VALUES (?, ?, ?, ?)',
          [
            workspace,
            membership.team_id,
            membership.user_id,
            membership.created_at.toISOString()
          ]
        );
      }
    });

    tx();
    return await this.listTeamMemberships(workspace);
  }

  async listWorkspaceMembers(workspace: string) {
    return this.all<WorkspaceMember>(
      'SELECT workspace, user_id, role, created_at FROM workspace_member WHERE workspace = ? ORDER BY role, user_id',
      [workspace],
      (row: Record<string, unknown>) => ({
        workspace: String(row.workspace),
        user_id: String(row.user_id),
        role: String(row.role) as WorkspaceRole,
        created_at: new Date(String(row.created_at)),
      })
    );
  }

  async getWorkspaceMember(workspace: string, userId: string) {
    return this.get<WorkspaceMember>(
      'SELECT workspace, user_id, role, created_at FROM workspace_member WHERE workspace = ? AND user_id = ?',
      [workspace, userId],
      (row: Record<string, unknown>) => ({
        workspace: String(row.workspace),
        user_id: String(row.user_id),
        role: String(row.role) as WorkspaceRole,
        created_at: new Date(String(row.created_at)),
      })
    );
  }

  async setWorkspaceMemberRole(workspace: string, userId: string, role: WorkspaceRole, createdAt: Date) {
    this.run(
      `INSERT INTO workspace_member (workspace, user_id, role, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(workspace, user_id) DO UPDATE SET role = excluded.role`,
      [workspace, userId, role, createdAt.toISOString()]
    );
    return (await this.getWorkspaceMember(workspace, userId))!;
  }

  async removeWorkspaceMember(workspace: string, userId: string) {
    const member = await this.getWorkspaceMember(workspace, userId);
    if (!member) return null;
    this.run('DELETE FROM workspace_member WHERE workspace = ? AND user_id = ?', [workspace, userId]);
    return member;
  }

  async getWorkspaceRole(workspace: string, userId: string) {
    const member = await this.getWorkspaceMember(workspace, userId);
    return member?.role ?? null;
  }
}
