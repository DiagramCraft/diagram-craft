// ── Core Permission Types ─────────────────────────────────────

export type GlobalRole = 'platform_admin' | 'schema_admin' | 'user_admin' | 'auditor';

export type GlobalPermission =
  | 'view_schema'
  | 'edit_schema'
  | 'manage_users'
  | 'manage_teams'
  | 'manage_global_roles'
  | 'view_audit'
  | 'admin_platform';

export type EntityRole = 'viewer' | 'editor' | 'contributor' | 'entity_admin';

export type EntityAction = 'view_entity' | 'edit_entity' | 'create_child' | 'admin_entity';

export type ProjectAction = 'edit_project' | 'delete_project' | 'manage_files';

export type EntityGrantScope = 'self' | 'subtree';

export type VisibilityMode = 'public' | 'restricted';

// ── Capability Types ──────────────────────────────────────────

export type EntityCapabilities = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAdmin: boolean;
  canCreateChild: boolean;
};

export type ProjectCapabilities = {
  canEdit: boolean;
  canDelete: boolean;
  canManageFiles: boolean;
};

// ── Entity & Schema Types ─────────────────────────────────────

export type EntityLink = {
  url: string;
  title: string;
  type?: string;
};

export type TextField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

export type BooleanField = {
  id: string;
  name: string;
  type: 'boolean';
};

export type SelectField = {
  id: string;
  name: string;
  type: 'select';
  options: Array<{ value: string; label: string }>;
};

export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type SchemaField =
  | TextField
  | BooleanField
  | SelectField
  | ReferenceField
  | ContainmentField;

export type EntitySchema = {
  id: string;
  workspace: string;
  name: string;
  fields: SchemaField[];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  created_at: Date;
  updated_at: Date;
};

export type Entity = {
  id: string;
  workspace: string;
  slug: string;
  namespace: string;
  name: string;
  description: string;
  owner: string | null;
  lifecycle: string | null;
  tags: string[];
  links: EntityLink[];
  schema_id: string;
  data: Record<string, unknown>;
  visibility_mode: VisibilityMode | null;
  created_at: Date;
  updated_at: Date;
};

// ── Owner Types ───────────────────────────────────────────────

export type WorkspaceOwnerOption = {
  id: string;
  name: string;
  type: 'team';
};

// ── Grant Types ───────────────────────────────────────────────

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

// ── Authorization Context ─────────────────────────────────────

export type AuthorizationContext = {
  userId: string;
  globalRoles: Set<GlobalRole>;
  globalPermissions: Set<GlobalPermission>;
  teamIds: Set<string>;
  ownerOptions: WorkspaceOwnerOption[];
  schemas: Map<string, EntitySchema>;
  entities: Map<string, Entity>;
  grants: EntityGrant[];
};



// ── Utility Functions ─────────────────────────────────────────

export const encodeRefs = (refs: string[]): string => refs.join(',');

export const decodeRefs = (raw: unknown): string[] => {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};
