import type { AiDatabase } from '../domain/ai/db/aiDatabase';
import type { AuditDatabase } from '../domain/audit/db/auditDatabase';
import type { AuthDatabase } from '../domain/auth/db/authDatabase';
import type { CatalogDatabase, ViewDatabase } from '../domain/catalog/db/catalogDatabase';
import type { ProjectDatabase } from '../domain/project/db/projectDatabase';
import type { WatchDatabase } from '../domain/watch/db/watchDatabase';
import type { DiscussionDatabase } from '../domain/discussion/db/discussionDatabase';
import type { WorkspaceDatabase } from '../domain/workspace/db/workspaceDatabase';
import type { JobDatabase } from '../domain/jobs/jobsDatabase';
import type { ExternalContentDatabase } from '../domain/external-content/db/externalContentDatabase';
// Keep the existing import path stable for database consumers.
// biome-ignore lint/performance/noBarrelFile: compatibility re-export for database errors
export { DatabaseError, type NormalizedDbErrorCode } from './databaseError';

export type DbDriver = 'postgres' | 'sqlite';

export type CoreDatabase = {
  driver: DbDriver;
  close(): Promise<void>;
  reset(): Promise<void>;
  transaction<T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T>;
};

export type DatabaseAdapter = {
  core: CoreDatabase;
  workspace: WorkspaceDatabase;
  catalog: CatalogDatabase;
  view: ViewDatabase;
  project: ProjectDatabase;
  audit: AuditDatabase;
  watch: WatchDatabase;
  auth: AuthDatabase;
  ai: AiDatabase;
  discussion: DiscussionDatabase;
  jobs: JobDatabase;
  externalContent: ExternalContentDatabase;
};

// Re-export domain types for convenience if needed, or just let consumers import from domain
export type {
  AiDatabase,
  AiConfigInputDbUpsert,
  AiConversationDbCreate,
  AiMessageDbCreate
} from '../domain/ai/db/aiDatabase';
export type { AuditDatabase, AuditLogDbCreate } from '../domain/audit/db/auditDatabase';
export type { AuthDatabase, UserDbCreate, UserDbUpdate } from '../domain/auth/db/authDatabase';
export type { WatchDatabase, WatchDbCreate } from '../domain/watch/db/watchDatabase';
export type {
  DiscussionDatabase,
  DiscussionObjectType,
  DiscussionPostDbCreate,
  DiscussionPostDbResult
} from '../domain/discussion/db/discussionDatabase';
export type {
  CatalogDatabase,
  ViewDatabase,
  SchemaDbCreate,
  SchemaDbUpdate,
  WorkspaceEnumDbCreate,
  WorkspaceEnumDbUpdate,
  EntityDbCreate,
  EntityDbUpdate,
  EntityGrantDbCretae,
  SavedViewDbCreate,
  SavedViewDbUpdate,
  PinnedEntityDbCreate
} from '../domain/catalog/db/catalogDatabase';
export type {
  ProjectDatabase,
  ProjectDbCreate,
  ProjectDbUpdate,
  ContentNodeDbUpsert,
  DiagramEntityFileDbResult
} from '../domain/project/db/projectDatabase';
export type {
  WorkspaceDatabase,
  WorkspaceDbCreate,
  WorkspaceDbUpdate
} from '../domain/workspace/db/workspaceDatabase';
export type {
  JobDatabase,
  JobRunClaim,
  JobRunCompletion,
  JobRunDbResult,
  JobRunFailure,
  JobRunListOptions,
  JobRunPage,
  JobRunStatus,
  JobServerDbRegistration,
  JobServerDbResult,
  JobServerStatus,
  JobScheduleDbCreate,
  JobScheduleDbResult,
  JobScheduleDbUpdate,
  JobScheduleRecurrence
} from '../domain/jobs/jobsDatabase';
export type {
  ExternalContentDatabase,
  ExternalContentMountDbCreate,
  ExternalContentMountDbResult,
  ExternalContentSourceDbCreate,
  ExternalContentSourceDbResult,
  ExternalContentStatus,
  GitSourceConfig
} from '../domain/external-content/db/externalContentDatabase';

// Legacy names for backward compatibility during transition if needed,
// but we plan to update all usages.
// For now, let's not add legacy names to keep it clean.
