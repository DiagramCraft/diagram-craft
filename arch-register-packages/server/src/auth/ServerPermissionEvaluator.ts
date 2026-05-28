import {
  PermissionEvaluator,
  type AuthorizationContext,
  type Entity,
  type EntityGrant,
  type EntitySchema,
  type GlobalRole,
  type PermissionDataProvider
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../db/database.js';

/**
 * Server-side data provider that fetches permission data from the database
 */
export class ServerDataProvider implements PermissionDataProvider {
  constructor(private db: DatabaseAdapter) {}

  async getEntities(workspaceId: string): Promise<Entity[]> {
    return this.db.listEntities(workspaceId);
  }

  async getSchemas(workspaceId: string): Promise<EntitySchema[]> {
    return this.db.listSchemas(workspaceId);
  }

  async getEntityGrants(workspaceId: string): Promise<EntityGrant[]> {
    return this.db.listEntityGrants(workspaceId);
  }

  async getTeamMemberships(workspaceId: string, userId: string): Promise<string[]> {
    const memberships = await this.db.listTeamMemberships(workspaceId);
    return memberships.filter(m => m.user_id === userId).map(m => m.team_id);
  }

  async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
    const assignments = await this.db.listGlobalRoleAssignments(userId);
    return assignments.map(a => a.role);
  }
}

/**
 * Server-side permission evaluator that uses database queries
 */
export class ServerPermissionEvaluator extends PermissionEvaluator {
  constructor() {
    super();
  }

  async buildContext(
    workspaceId: string,
    userId: string,
    dataProvider: PermissionDataProvider
  ): Promise<AuthorizationContext> {
    const [globalRoles, teamMemberships, schemas, entities, grants] = await Promise.all([
      dataProvider.getGlobalRoles(userId),
      dataProvider.getTeamMemberships(workspaceId, userId),
      dataProvider.getSchemas(workspaceId),
      dataProvider.getEntities(workspaceId),
      dataProvider.getEntityGrants(workspaceId)
    ]);

    return this.buildAuthorizationContextFromData(
      userId,
      globalRoles,
      teamMemberships,
      schemas,
      entities,
      grants
    );
  }
}
