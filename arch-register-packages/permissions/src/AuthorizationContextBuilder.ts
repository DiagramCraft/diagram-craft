import type {
  AuthorizationContext,
  Entity,
  EntityGrant,
  EntitySchema,
  GlobalRole,
  WorkspaceOwnerOption
} from './types.js';
import { getGlobalPermissionsForRoles } from './constants.js';

/**
 * Data provider interface for fetching permission-related data.
 * Implementations provide data from different sources (database, API, etc.)
 */
export interface PermissionDataProvider {
  /**
   * Fetch all entities in workspace (for relationship traversal)
   */
  getEntities(workspaceId: string): Promise<Entity[]>;

  /**
   * Fetch all schemas (for field definitions)
   */
  getSchemas(workspaceId: string): Promise<EntitySchema[]>;

  /**
   * Fetch entity grants for permission evaluation
   */
  getEntityGrants(workspaceId: string): Promise<EntityGrant[]>;

  /**
   * Fetch user's team memberships
   */
  getTeamMemberships(workspaceId: string, userId: string): Promise<string[]>;

  /**
   * Fetch user's global role assignments
   */
  getGlobalRoles(userId: string): Promise<GlobalRole[]>;

  /**
   * Fetch workspace owner options (teams that can own records)
   */
  getOwnerOptions(workspaceId: string): Promise<WorkspaceOwnerOption[]>;
}

export type AuthorizationContextData = {
  userId: string;
  globalRoles: GlobalRole[];
  teamMemberships: string[];
  ownerOptions: WorkspaceOwnerOption[];
  schemas: EntitySchema[];
  entities: Entity[];
  grants: EntityGrant[];
};

export const buildAuthorizationContext = ({
  userId,
  globalRoles,
  teamMemberships,
  ownerOptions,
  schemas,
  entities,
  grants
}: AuthorizationContextData): AuthorizationContext => {
  const globalRolesSet = new Set(globalRoles);
  const globalPermissions = getGlobalPermissionsForRoles(globalRolesSet);

  return {
    userId,
    globalRoles: globalRolesSet,
    globalPermissions,
    teamIds: new Set(teamMemberships),
    ownerOptions,
    schemas: new Map(schemas.map(schema => [schema.id, schema])),
    entities: new Map(entities.map(entity => [entity.id, entity])),
    grants
  };
};

export const fetchAuthorizationContextData = async (
  dataProvider: PermissionDataProvider,
  workspaceId: string,
  userId: string
): Promise<AuthorizationContextData> => {
  const [globalRoles, teamMemberships, ownerOptions, schemas, entities, grants] =
    await Promise.all([
      dataProvider.getGlobalRoles(userId),
      dataProvider.getTeamMemberships(workspaceId, userId),
      dataProvider.getOwnerOptions(workspaceId),
      dataProvider.getSchemas(workspaceId),
      dataProvider.getEntities(workspaceId),
      dataProvider.getEntityGrants(workspaceId)
    ]);

  return {
    userId,
    globalRoles,
    teamMemberships,
    ownerOptions,
    schemas,
    entities,
    grants
  };
};