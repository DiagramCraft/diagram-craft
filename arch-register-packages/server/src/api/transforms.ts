import type {
  EntityRecord,
  EntitySummary,
  EntitySchema,
  Project,
  ProjectFile,
  FileTree,
  ProjectDetail,
  Workspace,
  AuditLogEntry,
  WorkspaceLifecycleState,
  WorkspaceOwnerOption,
  WorkspaceMemberInfo,
  WorkspaceUserInfo,
  WorkspaceEnum,
} from '@arch-register/api-types';
import type {
  Entity,
  EntitySchema as InternalEntitySchema,
  Project as InternalProject,
  ProjectFile as InternalProjectFile,
  Workspace as InternalWorkspace,
  AuditLogEntry as InternalAuditLogEntry,
  WorkspaceLifecycleState as InternalWorkspaceLifecycleState,
  WorkspaceOwner,
  WorkspaceMember,
  User,
  WorkspaceEnum as InternalWorkspaceEnum,
} from '../types.js';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';

const checker = new PermissionChecker();

// ── Entity Transformations ────────────────────────────────────

const getEntityCapabilities = (context: AuthorizationContext | null, entity: Entity) => {
  if (!context) {
    return {
      canView: true,
      canEdit: true,
      canDelete: true,
      canAdmin: true,
      canCreateChild: true,
    };
  }

  return {
    canView: checker.hasEntityPermission(context, entity, 'view_entity'),
    canEdit: checker.hasEntityPermission(context, entity, 'edit_entity'),
    canDelete: checker.hasEntityPermission(context, entity, 'admin_entity'),
    canAdmin: checker.hasEntityPermission(context, entity, 'admin_entity'),
    canCreateChild: checker.hasEntityPermission(context, entity, 'create_child'),
  };
};

export const toApiEntity = (
  entity: Entity,
  authCtx: AuthorizationContext | null,
  completeness: number | null = null
): EntityRecord => ({
  _uid: entity.id,
  _workspace: entity.workspace,
  _schemaId: entity.schema_id,
  _name: entity.name,
  _slug: entity.slug,
  _namespace: entity.namespace,
  _description: entity.description,
  _owner: entity.owner,
  _lifecycle: entity.lifecycle,
  _tags: entity.tags,
  _links: entity.links,
  _visibilityMode: entity.visibility_mode,
  _completeness: completeness,
  ...getEntityCapabilities(authCtx, entity),
  ...entity.data,
});

export const toApiEntitySummary = (
  entity: Entity,
  authCtx: AuthorizationContext | null,
  completeness: number | null = null
): EntitySummary => ({
  _uid: entity.id,
  _workspace: entity.workspace,
  _schemaId: entity.schema_id,
  _name: entity.name,
  _slug: entity.slug,
  _namespace: entity.namespace,
  _description: entity.description,
  _owner: entity.owner,
  _lifecycle: entity.lifecycle,
  _tags: entity.tags,
  _links: entity.links,
  _visibilityMode: entity.visibility_mode,
  _completeness: completeness,
  ...getEntityCapabilities(authCtx, entity),
});

// ── Schema Transformations ────────────────────────────────────

export const toApiEnum = (e: InternalWorkspaceEnum): WorkspaceEnum => ({
  id: e.id,
  workspace: e.workspace,
  name: e.name,
  options: e.options,
  sort_order: e.sort_order,
  created_at: e.created_at.toISOString(),
  updated_at: e.updated_at.toISOString(),
});

export const toApiSchema = (
  schema: InternalEntitySchema,
  entityCount: number,
  enums: InternalWorkspaceEnum[]
): EntitySchema => {
  const enumMap = new Map(enums.map(e => [e.id, e]));
  const fields = schema.fields.map(field => {
    if (field.type === 'select') {
      const enumDef = enumMap.get(field.enumId);
      return {
        ...field,
        options: enumDef?.options ?? [],
      };
    }
    return field;
  });
  return {
    id: schema.id,
    workspace: schema.workspace,
    name: schema.name,
    description: schema.description,
    fields,
    color: schema.color,
    icon: schema.icon,
    entity_count: entityCount,
    created_at: schema.created_at.toISOString(),
    updated_at: schema.updated_at.toISOString(),
  };
};

// ── Project Transformations ───────────────────────────────────

const getProjectCapabilities = (context: AuthorizationContext | null, _ownerTeamId: string | null) => {
  if (!context) {
    return {
      canEdit: true,
      canDelete: true,
      canManageFiles: true,
    };
  }

  // TODO: Implement proper project permission checking using _ownerTeamId
  // For now, use workspace-level permissions
  return {
    canEdit: true,
    canDelete: true,
    canManageFiles: true,
  };
};

export const toApiProject = (
  project: InternalProject,
  fileCount: number,
  authCtx: AuthorizationContext | null
): Project => ({
  id: project.id,
  workspace: project.workspace,
  name: project.name,
  description: project.description,
  owner: project.owner,
  status: project.status,
  color: project.color,
  file_count: fileCount,
  created_at: project.created_at.toISOString(),
  updated_at: project.updated_at.toISOString(),
  ...getProjectCapabilities(authCtx, project.owner),
});

export const toApiProjectFile = (file: InternalProjectFile): ProjectFile => ({
  id: file.id,
  project_id: file.project_id,
  path: file.path,
  name: file.name,
  size_bytes: file.size_bytes,
  comment_count: file.comment_count,
  unresolved_comment_count: file.unresolved_comment_count,
  is_template: file.is_template,
  is_workspace_template: file.is_workspace_template,
  preview_svg: file.preview_svg,
  created_at: file.created_at.toISOString(),
  updated_at: file.updated_at.toISOString(),
});

export const toApiProjectDetail = (
  project: InternalProject,
  files: FileTree,
  authCtx: AuthorizationContext | null
): ProjectDetail => ({
  id: project.id,
  workspace: project.workspace,
  name: project.name,
  description: project.description,
  owner: project.owner,
  status: project.status,
  color: project.color,
  file_count: files.folders.reduce((sum, f) => sum + f.files.length, 0) + files.rootFiles.length,
  created_at: project.created_at.toISOString(),
  updated_at: project.updated_at.toISOString(),
  ...getProjectCapabilities(authCtx, project.owner),
  files,
});

// ── Workspace Transformations ─────────────────────────────────

export const toApiWorkspace = (workspace: InternalWorkspace): Workspace => ({
  id: workspace.id,
  name: workspace.name,
  url_slug: workspace.url_slug,
  short_code: workspace.short_code,
  color: workspace.color,
  description: workspace.description,
  created_at: workspace.created_at.toISOString(),
  updated_at: workspace.updated_at.toISOString(),
});

export const toApiLifecycleState = (
  state: InternalWorkspaceLifecycleState
): WorkspaceLifecycleState => ({
  id: state.id,
  label: state.label,
  color: state.color,
  sort_order: state.sort_order,
});

export const toApiOwnerOption = (owner: WorkspaceOwner): WorkspaceOwnerOption => ({
  id: owner.id,
  sort_order: owner.sort_order,
});

export const toApiWorkspaceMember = (
  member: WorkspaceMember,
  user: User
): WorkspaceMemberInfo => ({
  workspace: member.workspace,
  user_id: member.user_id,
  role: member.role,
  display_name: user.display_name,
  email: user.email,
  created_at: member.created_at.toISOString(),
});

export const toApiWorkspaceUser = (user: User): WorkspaceUserInfo => ({
  id: user.id,
  email: user.email,
  display_name: user.display_name,
  auth_provider: user.auth_provider,
  is_active: user.is_active,
});

// ── Audit Transformations ─────────────────────────────────────

export const toApiAuditLogEntry = (entry: InternalAuditLogEntry): AuditLogEntry => ({
  id: entry.id,
  workspace: entry.workspace,
  timestamp: entry.timestamp.toISOString(),
  user_id: entry.user_id,
  operation: entry.operation,
  entity_type: entry.entity_type,
  entity_id: entry.entity_id,
  entity_name: entry.entity_name,
  entity_slug: entry.entity_slug,
  schema_id: entry.schema_id,
  changes: entry.changes,
  metadata: entry.metadata,
});
