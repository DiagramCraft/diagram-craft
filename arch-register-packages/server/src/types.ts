import { AuditEntityType, AuditOperation } from './domain/audit/db/auditDatabase';
import { UserRow } from './domain/auth/db/authDatabase';

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

export type EntityLink = {
  url: string;
  title: string;
  type?: string;
};

export type VisibilityMode = 'public' | 'restricted';

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

export const encodeRefs = (refs: string[]): string => refs.join(',');
export const decodeRefs = (raw: unknown): string[] => {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
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

export type GlobalRole = 'global_admin' | 'workspace_admin';

export type GlobalPermission = 'admin_platform' | 'create_workspaces' | 'manage_workspace_roles';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';

export type EntityRole = 'viewer' | 'editor' | 'contributor' | 'entity_admin';

export type AiProvider = 'openrouter' | 'openai';

export type AuthProvider = 'local' | 'oidc';

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
  user: UserRow;
  token: string;
};
