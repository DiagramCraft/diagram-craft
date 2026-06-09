export type {
  EntityCapabilities,
  ProjectCapabilities,
  RequirementLevel,
  TextField,
  BooleanField,
  DateField,
  SelectField,
  ReferenceField,
  ContainmentField,
  SchemaField
} from '@arch-register/api-types';
import type { BrowserView, EntityFilters, RadarViewConfig } from '@arch-register/api-types/views';
import type { SchemaField } from '@arch-register/api-types/schemas';

export type EntitySchema = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  fields: SchemaField[];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  created_at: Date;
  updated_at: Date;
};

export type WorkspaceEnum = {
  id: string;
  workspace: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type SavedView = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  view_mode: BrowserView;
  filters: EntityFilters;
  config: {
    radar?: RadarViewConfig;
  } | null;
  created_at: Date;
  updated_at: Date;
};

export type WorkspaceOwner = {
  id: string;
  workspace: string;
  name: string;
  sort_order: number;
  color: string | null;
  description: string;
  created_at: Date;
};

export type EntityLink = {
  url: string;
  title: string;
  type?: string;
};

export type VisibilityMode = 'public' | 'restricted';

export type Entity = {
  id: string;
  workspace: string;
  slug: string;
  namespace: string;
  name: string;
  description: string;
  owner: string | null;
  lifecycle: string | null;
  target_lifecycle: string | null;
  target_lifecycle_date: string | null;
  tags: string[];
  links: EntityLink[];
  schema_id: string;
  data: Record<string, unknown>;
  visibility_mode: VisibilityMode | null;
  created_at: Date;
  updated_at: Date;
};

// Wire format used by the DiagramCraft integration (flat strings, not ForeignKey shapes).
export type DiagramCraftEntityResponse = {
  _uid: string;
  _workspace: string;
  _schemaId: string;
  _name: string;
  _slug: string;
  _namespace: string;
  _description: string;
  _owner: string | null;
  _lifecycle: string | null;
  _targetLifecycle: string | null;
  _targetLifecycleDate: string | null;
  _tags: string[];
  _links: EntityLink[];
  _visibilityMode: VisibilityMode | null;
  [field: string]: unknown;
};

export type Project = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  owner: string | null;
  status: 'pinned' | 'active' | 'archived';
  color: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ProjectFile = {
  id: string;
  workspace: string;
  project_id: string;
  path: string;
  name: string;
  size_bytes: number;
  comment_count: number;
  unresolved_comment_count: number;
  is_template: boolean;
  is_workspace_template: boolean;
  preview_svg: string | null;
  created_at: Date;
  updated_at: Date;
};

export const encodeRefs = (refs: string[]): string => refs.join(',');
export const decodeRefs = (raw: unknown): string[] => {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditEntityType = 'workspace' | 'entity_schema' | 'entity' | 'project' | 'project_file';

export type AuditLogEntry = {
  id: string;
  workspace: string;
  timestamp: Date;
  user_id: string | null;
  operation: AuditOperation;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string;
  entity_slug: string | null;
  schema_id: string | null;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
};

export type UserWatch = {
  user_id: string;
  workspace: string;
  entity_id: string;
  created_at: Date;
};

export type UserPinnedEntity = {
  user_id: string;
  workspace: string;
  entity_id: string;
  created_at: Date;
};

export type UserNotification = {
  id: string;
  user_id: string;
  workspace: string;
  entity_id: string;
  audit_log_id: string;
  operation: AuditOperation;
  entity_name: string;
  entity_slug: string;
  schema_id: string | null;
  changed_by_user_id: string;
  changed_by_display_name: string;
  timestamp: Date;
  created_at: Date;
};

export type AuditLogApiResponse = {
  id: string;
  workspace: string;
  timestamp: string;
  user_id: string;
  operation: AuditOperation;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string;
  entity_slug: string | null;
  schema_id: string | null;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
};

export type AuthProvider = 'local' | 'oidc';

export type User = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string;
  auth_provider: AuthProvider;
  password_hash: string | null;
  oidc_issuer: string | null;
  oidc_subject: string | null;
  is_active: boolean;
  color: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

export type GlobalRole = 'global_admin' | 'workspace_admin';

export type GlobalPermission = 'admin_platform' | 'create_workspaces' | 'manage_workspace_roles';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';

export type WorkspaceRoleCapability =
  | 'ws.view'
  | 'ws.settings'
  | 'ws.delete'
  | 'ws.audit'
  | 'ws.manage_views'
  | 'people.invite'
  | 'people.role'
  | 'people.remove'
  | 'people.teams'
  | 'proj.create'
  | 'proj.edit'
  | 'ent.edit'
  | 'ent.propose'
  | 'comments'
  | 'export'
  | 'schema.edit'
  | 'schema.publish';

export type WorkspaceRoleDefinition = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  tone: string;
  builtin: boolean;
  capabilities: WorkspaceRoleCapability[];
  created_at: Date;
  updated_at: Date;
};

export type TeamRole = 'team_admin' | 'team_editor' | 'team_reviewer';

export type WorkspaceMember = {
  workspace: string;
  user_id: string;
  role: string;
  created_at: Date;
};

export type TeamMembership = {
  workspace: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: Date;
};

export type GlobalRoleAssignment = {
  user_id: string;
  role: GlobalRole;
  created_at: Date;
};

export type EntityRole = 'viewer' | 'editor' | 'contributor' | 'entity_admin';
export type EntityGrantScope = 'self' | 'subtree';

export type EntityGrant = {
  id: string;
  workspace: string;
  entity_id: string;
  principal_type: 'user' | 'team';
  principal_id: string;
  role: EntityRole;
  applies_to: EntityGrantScope;
  created_at: Date;
};

export type AiProvider = 'openrouter' | 'openai';

export type WorkspaceAiConfig = {
  workspace: string;
  provider: AiProvider;
  api_key_enc: string | null;
  base_url: string | null;
  model: string | null;
  temperature: number | null;
  system_prompt: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export type AiConversation = {
  id: string;
  workspace: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export type JWTPayload = {
  sub: string;
  email?: string;
  name: string;
  provider: AuthProvider;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
};

export type AuthContext = {
  user: User;
  token: string;
};
