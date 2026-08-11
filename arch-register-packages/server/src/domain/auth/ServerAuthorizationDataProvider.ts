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
import type {
  EntityDbResult,
  EntityGrantDbResult,
  SchemaDbResult
} from '../catalog/db/catalogDatabase';
import { listAllCatalogEntities } from '../catalog/entityLoader';

const toPermissionEntity = (entity: EntityDbResult): Entity => ({
  id: entity.id,
  workspace: entity.workspace,
  slug: entity.slug,
  namespace: entity.namespace,
  name: entity.name,
  description: entity.description,
  owner: entity.owner,
  lifecycle: entity.lifecycle,
  tags: entity.tags,
  links: entity.links,
  schema_id: entity.schema_id,
  data: entity.data,
  created_at: entity.created_at,
  updated_at: entity.updated_at
});

const toPermissionSchema = (schema: SchemaDbResult): EntitySchema => ({
  id: schema.id,
  workspace: schema.workspace,
  name: schema.name,
  fields: schema.fields,
  color: schema.color,
  icon: schema.icon,
  default_owner: schema.default_owner,
  created_at: schema.created_at,
  updated_at: schema.updated_at
});

const toPermissionEntityGrant = (grant: EntityGrantDbResult): EntityGrant => ({
  id: grant.id,
  workspace: grant.workspace,
  entity_id: grant.entity_id,
  principal_type: grant.principal_type,
  principal_id: grant.principal_id,
  role: grant.role,
  applies_to: grant.applies_to,
  created_at: grant.created_at
});

/**
 * Server-side data provider that fetches permission data from the database
 */
export class ServerDataProvider implements PermissionDataProvider {
  constructor(private db: DatabaseAdapter) {}

  async getEntities(workspaceId: string): Promise<Entity[]> {
    const entities = await listAllCatalogEntities(this.db, workspaceId);
    return entities.map(toPermissionEntity);
  }

  async getSchemas(workspaceId: string): Promise<EntitySchema[]> {
    const schemas = await this.db.catalog.listSchemas(workspaceId);
    return schemas.map(toPermissionSchema);
  }

  async getEntityGrants(workspaceId: string): Promise<EntityGrant[]> {
    const grants = await this.db.catalog.listEntityGrants(workspaceId);
    return grants.map(toPermissionEntityGrant);
  }

  async getTeamAssignments(workspaceId: string, userId: string): Promise<TeamAssignment[]> {
    const memberships = await this.db.workspace.listTeamAssignments(workspaceId);
    return memberships
      .filter(m => m.user_id === userId)
      .map(m => ({ teamId: m.team_id, role: m.role }));
  }

  async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
    const assignments = await this.db.auth.listGlobalRoleAssignments(userId);
    return assignments.map(a => a.role);
  }

  async getTeams(workspaceId: string): Promise<WorkspaceTeam[]> {
    const teams = await this.db.workspace.listTeams(workspaceId);
    return teams.map(team => ({ id: team.id, name: team.name, type: 'team' as const }));
  }

  async getWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    return this.db.workspace.getWorkspaceRole(workspaceId, userId);
  }

  async getWorkspaceRoles(workspaceId: string) {
    return resolveWorkspaceRoleDefinitions(
      await this.db.workspace.listCustomWorkspaceRoles(workspaceId)
    );
  }
}
