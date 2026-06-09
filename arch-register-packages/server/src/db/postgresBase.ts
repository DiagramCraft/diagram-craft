import postgres from 'postgres';
import type {
  AuditLogEntry,
  Entity,
  EntitySchema,
  GlobalRoleAssignment,
  Project,
  ProjectFile,
  User,
  Workspace,
  WorkspaceEnum,
  WorkspaceLifecycleState,
  WorkspaceRoleDefinition,
  WorkspaceOwner,
  TeamMembership,
  EntityGrant,
  SavedView,
  UserNotification,
  UserPinnedEntity,
  UserWatch
} from '../types';
import type { EnrichedEntity } from '../domain/catalog/db/catalogDatabase';
import type { EnrichedProject } from '../domain/project/db/projectDatabase';
import { DB_ERROR_CODES } from '../constants';
import { DatabaseError } from './database';

export type PostgresSqlClient = ReturnType<typeof postgres>;

export const normalizePostgresError = (error: unknown): never => {
  if (error != null && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === DB_ERROR_CODES.UNIQUE)
      throw new DatabaseError('unique', 'Unique constraint violation', error);
    if (code === DB_ERROR_CODES.FOREIGN_KEY)
      throw new DatabaseError('foreign', 'Foreign key constraint violation', error);
    if (code === DB_ERROR_CODES.CHECK)
      throw new DatabaseError('check', 'Check constraint violation', error);
    if (code === DB_ERROR_CODES.NOT_NULL)
      throw new DatabaseError('notnull', 'Not null constraint violation', error);
  }
  throw new DatabaseError('unknown', 'Database operation failed', error);
};

export class PostgresDatabaseBase {
  constructor(protected readonly sql: PostgresSqlClient) {}

  protected json(value: unknown) {
    return this.sql.json(value as Parameters<PostgresSqlClient['json']>[0]);
  }
}

export type PostgresRowTypes = {
  workspace: Workspace;
  lifecycleState: WorkspaceLifecycleState;
  owner: WorkspaceOwner;
  teamMembership: TeamMembership;
  schema: EntitySchema;
  workspaceEnum: WorkspaceEnum;
  entity: Entity;
  enrichedEntity: EnrichedEntity;
  enrichedProject: EnrichedProject;
  entityGrant: EntityGrant;
  savedView: SavedView;
  project: Project;
  projectFile: ProjectFile;
  auditLog: AuditLogEntry;
  userWatch: UserWatch;
  userPinnedEntity: UserPinnedEntity;
  userNotification: UserNotification;
  user: User;
  globalRoleAssignment: GlobalRoleAssignment;
  workspaceRoleDefinition: WorkspaceRoleDefinition;
};
