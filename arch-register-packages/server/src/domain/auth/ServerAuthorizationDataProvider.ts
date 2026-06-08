import {
  type Entity,
  type EntityGrant,
  type EntitySchema,
  type GlobalRole,
  type PermissionDataProvider,
  type TeamAssignment,
  type WorkspaceTeam,
  type WorkspaceRole,
  resolveWorkspaceRoleDefinitions
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';

/**
 * Server-side data provider that fetches permission data from the database
 */
export class ServerDataProvider implements PermissionDataProvider {
  constructor(private db: DatabaseAdapter) {}

  async getEntities(workspaceId: string): Promise<Entity[]> {
    return this.db.catalog.listEntities(workspaceId);
  }

  async getSchemas(workspaceId: string): Promise<EntitySchema[]> {
    return this.db.catalog.listSchemas(workspaceId) as unknown as EntitySchema[];
  }

  async getEntityGrants(workspaceId: string): Promise<EntityGrant[]> {
    return this.db.catalog.listEntityGrants(workspaceId);
  }

  async getTeamAssignments(workspaceId: string, userId: string): Promise<TeamAssignment[]> {
    const memberships = await this.db.workspaceAdmin.listTeamAssignments(workspaceId);
    return memberships
      .filter(m => m.user_id === userId)
      .map(m => ({ teamId: m.team_id, role: m.role }));
  }

  async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
    const assignments = await this.db.identityAuth.listGlobalRoleAssignments(userId);
    return assignments.map(a => a.role);
  }

  async getTeams(workspaceId: string): Promise<WorkspaceTeam[]> {
    const teams = await this.db.workspaceAdmin.listTeams(workspaceId);
    return teams.map(team => ({ id: team.id, name: team.id, type: 'team' as const }));
  }

  async getWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    return this.db.workspaceAdmin.getWorkspaceRole(workspaceId, userId);
  }

  async getWorkspaceRoles(workspaceId: string) {
    return resolveWorkspaceRoleDefinitions(
      await this.db.workspaceAdmin.listCustomWorkspaceRoles(workspaceId)
    );
  }
}
