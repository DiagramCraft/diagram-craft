import type { AiDatabase } from '../domain/ai/db/aiDatabase';
import type { AuditDatabase } from '../domain/audit/db/auditDatabase';
import type { AuthDatabase } from '../domain/auth/db/authDatabase';
import type { CatalogDatabase, ViewDatabase } from '../domain/catalog/db/catalogDatabase';
import type { ProjectDatabase } from '../domain/project/db/projectDatabase';
import type { WorkspaceDatabase } from '../domain/workspace/db/workspaceDatabase';

export type DbDriver = 'postgres' | 'sqlite';

export type NormalizedDbErrorCode = 'unique' | 'foreign' | 'check' | 'notnull' | 'unknown';

export class DatabaseError extends Error {
  constructor(
    readonly code: NormalizedDbErrorCode,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
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
  auth: AuthDatabase;
  ai: AiDatabase;
};

// Re-export domain types for convenience if needed, or just let consumers import from domain
export type {
  AiDatabase,
  UpsertAiConfigInput,
  CreateConversationInput,
  CreateMessageInput
} from '../domain/ai/db/aiDatabase';
export type { AuditDatabase, CreateAuditLogInput } from '../domain/audit/db/auditDatabase';
export type { AuthDatabase, CreateUserInput, UpdateUserInput } from '../domain/auth/db/authDatabase';
export type {
  CatalogDatabase,
  ViewDatabase,
  CreateSchemaInput,
  UpdateSchemaInput,
  CreateEnumInput,
  UpdateEnumInput,
  CreateEntityInput,
  UpdateEntityInput,
  CreateEntityGrantInput,
  CreateSavedViewInput,
  UpdateSavedViewInput
} from '../domain/catalog/db/catalogDatabase';
export type {
  ProjectDatabase,
  CreateProjectInput,
  UpdateProjectInput,
  UpsertProjectFileInput
} from '../domain/project/db/projectDatabase';
export type {
  WorkspaceDatabase,
  CreateWorkspaceInput,
  UpdateWorkspaceInput
} from '../domain/workspace/db/workspaceDatabase';

// Legacy names for backward compatibility during transition if needed, 
// but we plan to update all usages. 
// For now, let's not add legacy names to keep it clean.
