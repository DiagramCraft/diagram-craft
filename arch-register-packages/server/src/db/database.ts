import type { AiDatabase } from '../domain/ai/db/aiDatabase';
import type { AuditDatabase } from '../domain/audit/db/auditDatabase';
import type { AuthDatabase } from '../domain/auth/db/authDatabase';
import type { CatalogDatabase, ViewDatabase } from '../domain/catalog/db/catalogDatabase';
import type { ProjectDatabase } from '../domain/project/db/projectDatabase';
import type { WatchDatabase } from '../domain/watch/db/watchDatabase';
import type { WorkspaceDatabase } from '../domain/workspace/db/workspaceDatabase';

export type DbDriver = 'postgres' | 'sqlite';

export type NormalizedDbErrorCode =
  | 'unique'          // Unique constraint violation
  | 'foreign'         // Foreign key constraint violation
  | 'check'           // Check constraint violation
  | 'notnull'         // Not null constraint violation
  | 'deadlock'        // Deadlock detected
  | 'timeout'         // Query timeout
  | 'connection'      // Connection error
  | 'serialization'   // Serialization failure (concurrent update)
  | 'disk_full'       // Disk full error
  | 'unknown';        // Unknown error

export class DatabaseError extends Error {
  constructor(
    readonly code: NormalizedDbErrorCode,
    message: string,
    readonly cause?: unknown,
    readonly details?: Record<string, unknown>  // Additional error details
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export type CoreDatabase = {
  driver: DbDriver;
  close(): Promise<void>;
  reset(): Promise<void>;
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

// Legacy names for backward compatibility during transition if needed,
// but we plan to update all usages.
// For now, let's not add legacy names to keep it clean.
