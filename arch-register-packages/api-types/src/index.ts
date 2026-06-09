// ── Common Types ──────────────────────────────────────────────
export type {
  VisibilityMode,
  EntityLink,
  EntityCapabilities,
  ProjectCapabilities,
  ErrorResponse,
  SuccessMessage,
  CountSuccessMessage,
} from './common.js';

// ── Schema Types ──────────────────────────────────────────────
export type {
  RequirementLevel,
  FieldOption,
  TextField,
  BooleanField,
  DateField,
  SelectField,
  ApiSelectField,
  ReferenceField,
  ContainmentField,
  SchemaField,
  ApiSchemaField,
  FieldType,
  EntitySchema,
  CreateSchemaRequest,
  UpdateSchemaRequest,
  SchemaSearchResult,
  WorkspaceEnum,
  CreateEnumRequest,
  UpdateEnumRequest,
} from './schemas.js';

// ── Entity Types ──────────────────────────────────────────────
export type {
  EntitySummary,
  EntityRecord,
  CreateEntityRequest,
  UpdateEntityRequest,
  EntityFacetBucket,
  EntitySchemaFacetBucket,
  EntityFacets,
  EntityRelation,
  EntityRelations,
  TreeNode,
  TreeEdge,
  TreeResponse,
  EntitySearchResult,
} from './entities.js';

// ── Project Types ─────────────────────────────────────────────
export type {
  Project,
  ProjectFile,
  FileFolder,
  FileTree,
  ProjectDetail,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateFolderRequest,
  CreateFolderResponse,
  RenameFolderRequest,
  RenameFileRequest,
  ProjectSearchResult,
  ProjectFileSearchResult,
  ProjectTemplatesResponse,
  ToggleTemplateStatusRequest,
} from './projects.js';

// ── Workspace Types ───────────────────────────────────────────
export type {
  Workspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceLifecycleState,
  WorkspaceOwnerOption,
  WorkspaceRoleCapability,
  WorkspaceRoleDefinition,
  CreateWorkspaceRoleRequest,
  UpdateWorkspaceRoleRequest,
  WorkspaceMemberInfo,
  WorkspaceUserInfo,
} from './workspaces.js';

// ── Search Types ──────────────────────────────────────────────
export type { SearchResponse } from './search.js';

// ── Audit Types ───────────────────────────────────────────────
export type {
  AuditOperation,
  AuditEntityType,
  AuditLogEntry,
  AuditStats,
} from './audit.js';

// ── Notifications / Watches ─────────────────────────────────
export type {
  WatchedEntity,
  PinnedEntity,
  NotificationItem,
  NotificationCount,
} from './notifications.js';

// ── AI Types ─────────────────────────────────────────────────
export type {
  AiProvider,
  WorkspaceAiConfig,
  UpsertAiConfigRequest,
  AiConversation,
  AiMessageRecord,
} from './ai.js';

export {
  workspaceEnumContract,
  workspaceEnumSchema,
  createEnumBodySchema,
  updateEnumBodySchema,
  createEnumRequestSchema,
  updateEnumRequestSchema,
  getEnumRequestSchema,
  listEnumsRequestSchema,
  deleteEnumRequestSchema,
  deleteEnumResponseSchema,
} from './enumContract.js';

export {
  workspaceSchemaContract,
  entitySchemaSchema,
  schemaFieldInputSchema,
  schemaFieldResponseSchema,
  createSchemaRequestSchema,
  updateSchemaRequestSchema,
  getSchemaRequestSchema,
  listSchemasRequestSchema,
  deleteSchemaRequestSchema,
  deleteSchemaResponseSchema,
} from './schemaContract.js';
