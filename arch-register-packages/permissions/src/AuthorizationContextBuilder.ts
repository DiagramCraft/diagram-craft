import type {
  AuthorizationContext,
  Entity,
  EntityGrant,
  EntitySchema,
  GlobalRole,
  TeamAssignment,
  WorkspaceTeam,
  WorkspaceRole
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
   * Fetch user's team assignments
   */
  getTeamAssignments(workspaceId: string, userId: string): Promise<TeamAssignment[]>;

  /**
   * Fetch user's global role assignments
   */
  getGlobalRoles(userId: string): Promise<GlobalRole[]>;

  /**
   * Fetch workspace owner options (teams that can own records)
   */
  getTeams(workspaceId: string): Promise<WorkspaceTeam[]>;

  /**
   * Fetch user's workspace role
   */
  getWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null>;
}

export type AuthorizationContextData = {
  userId: string;
  globalRoles: GlobalRole[];
  workspaceRole: WorkspaceRole | null;
  teamAssignments?: TeamAssignment[];
  teams?: WorkspaceTeam[];
  schemas: EntitySchema[];
  entities: Entity[];
  grants: EntityGrant[];
};

export const buildAuthorizationContext = ({
  userId,
  globalRoles,
  workspaceRole,
  teamAssignments,
  teams,
  schemas,
  entities,
  grants
}: AuthorizationContextData): AuthorizationContext => {
  const normalizedTeams = teams ?? [];
  const globalRolesSet = new Set(globalRoles);
  const globalPermissions = getGlobalPermissionsForRoles(globalRolesSet);
  const normalizedAssignments = teamAssignments ?? [];
  const teamRolesByTeam = new Map<string, Set<TeamAssignment['role']>>();
  for (const assignment of normalizedAssignments) {
    const roles = teamRolesByTeam.get(assignment.teamId) ?? new Set<TeamAssignment['role']>();
    roles.add(assignment.role);
    teamRolesByTeam.set(assignment.teamId, roles);
  }

  return {
    userId,
    globalRoles: globalRolesSet,
    globalPermissions,
    workspaceRole: workspaceRole ?? null,
    teamIds: new Set(normalizedAssignments.map(assignment => assignment.teamId)),
    teamAssignments: normalizedAssignments,
    teamRolesByTeam,
    teams: normalizedTeams,
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
  const [globalRoles, workspaceRole, teamAssignments, teams, schemas, entities, grants] =
    await Promise.all([
      dataProvider.getGlobalRoles(userId),
      dataProvider.getWorkspaceRole(workspaceId, userId),
      dataProvider.getTeamAssignments(workspaceId, userId),
      dataProvider.getTeams(workspaceId),
      dataProvider.getSchemas(workspaceId),
      dataProvider.getEntities(workspaceId),
      dataProvider.getEntityGrants(workspaceId)
    ]);

  return {
    userId,
    globalRoles,
    workspaceRole,
    teamAssignments,
    teams,
    schemas,
    entities,
    grants
  };
};
