// ── Common Types ──────────────────────────────────────────────
export type {
  VisibilityMode,
  EntityLink,
  EntityCapabilities,
  ProjectCapabilities,
  ErrorResponse,
  SuccessMessage,
  CountSuccessMessage
} from './common';

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
  UpdateEnumRequest
} from './schemas';

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
  EntitySearchResult
} from './entities';

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
  ToggleTemplateStatusRequest
} from './projects';

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
  WorkspaceUserInfo
} from './workspaces';

// ── Search Types ──────────────────────────────────────────────
export type { SearchResponse } from './search';

// ── Audit Types ───────────────────────────────────────────────
export type { AuditOperation, AuditEntityType, AuditLogEntry, AuditStats } from './audit';

// ── Notifications / Watches ─────────────────────────────────
export type {
  WatchedEntity,
  PinnedEntity,
  NotificationItem,
  NotificationCount
} from './notifications';

// ── AI Types ─────────────────────────────────────────────────
export type {
  AiProvider,
  WorkspaceAiConfig,
  UpsertAiConfigRequest,
  AiConversation,
  AiMessageRecord
} from './ai';

// biome-ignore lint/performance/noBarrelFile: <explanation>
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
  deleteEnumResponseSchema
} from './enumContract';

export {
  workspaceEntityContract,
  entityRecordSchema,
  entityFacetsSchema,
  treeResponseSchema,
  entityRelationsSchema,
  entityAccessSchema,
  importParseResponseSchema,
  importCommitResponseSchema,
  listEntitiesRequestSchema,
  getEntityRequestSchema,
  treeRequestSchema,
  facetsRequestSchema,
  createEntityRequestSchema,
  updateEntityRequestSchema,
  deleteEntityResponseSchema,
  getEntityAccessRequestSchema,
  updateEntityAccessRequestSchema,
  importParseRequestSchema,
  importCommitRequestSchema
} from './entityContract';

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
  deleteSchemaResponseSchema
} from './schemaContract';

export {
  workspaceTemplateContract,
  listWorkspaceTemplatesRequestSchema,
  listProjectTemplatesRequestSchema
} from './templateContract';

export {
  workspaceViewContract,
  listViewsRequestSchema,
  createViewRequestSchema,
  updateViewRequestSchema,
  getViewRequestSchema,
  deleteViewRequestSchema,
  listPinnedEntitiesRequestSchema,
  createPinnedEntityRequestSchema,
  deletePinnedEntityRequestSchema
} from './viewContract';

export {
  workspaceManagementContract,
  listWorkspacesRequestSchema,
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
  deleteWorkspaceRequestSchema
} from './workspaceContract';

export { workspaceConfigContract } from './workspaceConfigContract';

export {
  projectContract,
  listProjectsRequestSchema,
  getProjectRequestSchema,
  createProjectRequestSchema,
  updateProjectRequestSchema,
  deleteProjectRequestSchema,
  listProjectFilesRequestSchema,
  createFolderRequestSchema,
  renameFolderRequestSchema
} from './projectContract';

export {
  auditContract,
  listAuditLogRequestSchema,
  getAuditStatsRequestSchema
} from './auditContract';

export {
  watchContract,
  listWatchingRequestSchema,
  createWatchRequestSchema,
  deleteWatchRequestSchema,
  listNotificationsRequestSchema,
  getNotificationCountRequestSchema,
  deleteNotificationRequestSchema,
  clearNotificationsRequestSchema
} from './watchContract';

export { searchContract, searchRequestSchema } from './searchContract';

export { authPublicContract, authProtectedContract, authMeResponseSchema } from './authContract';

export { aiContract } from './aiContract';

export { diagramCraftContract } from './diagramCraftContract';
