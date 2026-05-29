import {
  type Entity,
  type EntityGrant,
  type EntitySchema,
  type GlobalRole,
  type PermissionDataProvider,
  type WorkspaceOwnerOption,
  type WorkspaceRole
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../db/database.js';

/**
 * Server-side data provider that fetches permission data from the database
 */
export class ServerDataProvider implements PermissionDataProvider {
  constructor(private db: DatabaseAdapter) {}

  async getEntities(workspaceId: string): Promise<Entity[]> {
    return this.db.catalog.listEntities(workspaceId);
  }

  async getSchemas(workspaceId: string): Promise<EntitySchema[]> {
    return this.db.catalog.listSchemas(workspaceId);
  }

  async getEntityGrants(workspaceId: string): Promise<EntityGrant[]> {
    return this.db.catalog.listEntityGrants(workspaceId);
  }

  async getTeamMemberships(workspaceId: string, userId: string): Promise<string[]> {
    const memberships = await this.db.workspaceAdmin.listTeamMemberships(workspaceId);
    return memberships.filter(m => m.user_id === userId).map(m => m.team_id);
  }

  async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
    const assignments = await this.db.identityAuth.listGlobalRoleAssignments(userId);
    return assignments.map(a => a.role);
  }

  async getOwnerOptions(workspaceId: string): Promise<WorkspaceOwnerOption[]> {
    const owners = await this.db.workspaceAdmin.listOwners(workspaceId);
    return owners.map(o => ({ id: o.id, name: o.id, type: 'team' as const }));
  }

  async getWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    return this.db.workspaceAdmin.getWorkspaceRole(workspaceId, userId);
  }
}