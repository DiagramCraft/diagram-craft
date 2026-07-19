import type { AiDatabase } from '../domain/ai/db/aiDatabase';
import type { AuditDatabase } from '../domain/audit/db/auditDatabase';
import type { AuthDatabase } from '../domain/auth/db/authDatabase';
import type { CatalogDatabase, ViewDatabase } from '../domain/catalog/db/catalogDatabase';
import type { ProjectDatabase } from '../domain/project/db/projectDatabase';
import type { WatchDatabase } from '../domain/watch/db/watchDatabase';
import type { DiscussionDatabase } from '../domain/discussion/db/discussionDatabase';
import type { WikiCommentDatabase } from '../domain/wikiComments/db/wikiCommentDatabase';
import type { WorkspaceDatabase } from '../domain/workspace/db/workspaceDatabase';
import type { JobDatabase } from '../domain/jobs/jobsDatabase';
import type { ExternalContentDatabase } from '../domain/external-content/db/externalContentDatabase';
import type { WebhookDatabase } from '../domain/webhook/db/webhookDatabase';
import type { DocumentDatabase } from '../domain/document/db/documentDatabase';
import type { GovernanceDatabase } from '../domain/governance/db/governanceDatabase';
import type { NotificationDatabase } from '../domain/notification/db/notificationDatabase';
import type { NotificationPreferenceDatabase } from '../domain/notification/db/notificationPreferenceDatabase';
import type { EntityChangeDatabase } from '../domain/catalog/db/entityChangeDatabase';
import type { EntityDeprecationDatabase } from '../domain/catalog/db/entityDeprecationDatabase';
// Keep the existing import path stable for database consumers.
// biome-ignore lint/performance/noBarrelFile: compatibility re-export for database errors
export { DatabaseError, type NormalizedDbErrorCode } from './databaseError';

export type DbDriver = 'postgres' | 'sqlite';

export type CoreDatabase = {
  driver: DbDriver;
  isTransaction?: boolean;
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
  wikiComment: WikiCommentDatabase;
  jobs: JobDatabase;
  externalContent: ExternalContentDatabase;
  webhook: WebhookDatabase;
  document: DocumentDatabase;
  governance: GovernanceDatabase;
  notification: NotificationDatabase;
  notificationPreference: NotificationPreferenceDatabase;
  entityChange: EntityChangeDatabase;
  entityDeprecation: EntityDeprecationDatabase;
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
  WikiCommentDatabase,
  WikiCommentDbCreate,
  WikiCommentDbResult
} from '../domain/wikiComments/db/wikiCommentDatabase';
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
  JobRunRetry,
  JobRunPage,
  JobRunStatus,
  JobServerDbRegistration,
  JobServerDbResult,
  JobServerStatus,
  JobScheduleDbCreate,
  JobScheduleDbResult,
  JobScheduleDbUpdate,
  JobScheduleRecurrence,
  OneOffJobRunDbCreate
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
export type {
  WebhookDatabase,
  WorkspaceWebhookDbCreate,
  WorkspaceWebhookDbResult,
  WorkspaceWebhookDbUpdate
} from '../domain/webhook/db/webhookDatabase';
export type { DocumentDatabase } from '../domain/document/db/documentDatabase';
export type {
  GovernanceDatabase,
  GovernanceAssignmentDbCreate,
  GovernanceCaseDbCreate,
  GovernanceEventDbCreate
} from '../domain/governance/db/governanceDatabase';
export type {
  NotificationDatabase,
  InboxNotificationDbCreate,
  InboxNotificationDbResult
} from '../domain/notification/db/notificationDatabase';
export type {
  NotificationPreferenceDatabase,
  NotificationPreferenceDbResult,
  NotificationPreferenceOverride
} from '../domain/notification/db/notificationPreferenceDatabase';
export type { EntityChangeDatabase } from '../domain/catalog/db/entityChangeDatabase';
export type { EntityDeprecationDatabase } from '../domain/catalog/db/entityDeprecationDatabase';

// Legacy names for backward compatibility during transition if needed,
// but we plan to update all usages.
// For now, let's not add legacy names to keep it clean.
