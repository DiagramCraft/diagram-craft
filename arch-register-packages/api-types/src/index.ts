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
  entitySummarySchema,
  entityRecordSchema,
  entityFacetBucketSchema,
  entityFacetsSchema,
  entityRelationSchema,
  entityRelationsSchema,
  treeNodeSchema,
  treeEdgeSchema,
  treeResponseSchema,
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
  fieldOptionSchema,
  selectFieldResponseSchema,
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
  browserViewSchema,
  filterConditionSchema,
  entityFiltersSchema,
  radarViewConfigSchema,
  timelineViewConfigSchema,
  savedViewSchema,
  createViewBodySchema,
  updateViewBodySchema,
  pinnedEntitySchema,
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
  workspaceSchema,
  listWorkspacesRequestSchema,
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
  deleteWorkspaceRequestSchema
} from './workspaceContract';

export { workspaceConfigContract, memberInfoSchema } from './workspaceConfigContract';

export {
  projectContract,
  projectSchema,
  projectFileSchema,
  fileFolderSchema,
  fileTreeSchema,
  projectDetailSchema,
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
  auditOperationSchema,
  auditEntityTypeSchema,
  auditLogEntrySchema,
  auditStatsSchema,
  listAuditLogRequestSchema,
  getAuditStatsRequestSchema
} from './auditContract';

export {
  watchContract,
  watchedEntitySchema,
  notificationItemSchema,
  notificationCountSchema,
  listWatchingRequestSchema,
  createWatchRequestSchema,
  deleteWatchRequestSchema,
  listNotificationsRequestSchema,
  getNotificationCountRequestSchema,
  deleteNotificationRequestSchema,
  clearNotificationsRequestSchema
} from './watchContract';

export {
  searchContract,
  searchResponseSchema,
  schemaSearchResultSchema,
  searchRequestSchema
} from './searchContract';

export { authPublicContract, authProtectedContract, authMeResponseSchema } from './authContract';

export { aiContract, aiConversationSchema, aiMessageSchema } from './aiContract';

export { diagramCraftContract } from './diagramCraftContract';
