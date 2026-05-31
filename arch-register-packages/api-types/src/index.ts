// ── Common Types ──────────────────────────────────────────────
export type {
  VisibilityMode,
  LifecycleStatus,
  EntityLink,
  EntityCapabilities,
  ProjectCapabilities,
  ErrorResponse,
  SuccessMessage,
  CountSuccessMessage,
} from './common.js';

// ── Schema Types ──────────────────────────────────────────────
export type {
  TextField,
  BooleanField,
  SelectField,
  ReferenceField,
  ContainmentField,
  SchemaField,
  FieldType,
  EntitySchema,
  CreateSchemaRequest,
  UpdateSchemaRequest,
  SchemaSearchResult,
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
