import type { z } from 'zod';
import type { memberInfoSchema } from './workspaceConfigContract.js';
import type { workspaceSchema } from './workspaceContract.js';

// ── Workspace Types ───────────────────────────────────────────

export type Workspace = z.infer<typeof workspaceSchema>;

// ── Request Types ─────────────────────────────────────────────

export type CreateWorkspaceRequest = {
  name: string;
  description?: string;
};

export type UpdateWorkspaceRequest = CreateWorkspaceRequest;

// ── Workspace Configuration ───────────────────────────────────

export type WorkspaceLifecycleState = {
  id: string;
  label: string;
  color: string;
  sort_order: number;
};

export type WorkspaceOwnerOption = {
  id: string;
  name: string;
  sort_order: number;
  color?: string | null;
  description?: string;
};

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
  name: string;
  description: string;
  tone: string;
  builtin: boolean;
  capabilities: WorkspaceRoleCapability[];
  created_at?: string;
  updated_at?: string;
};

export type CreateWorkspaceRoleRequest = {
  name: string;
  description: string;
  tone?: string;
  capabilities: WorkspaceRoleCapability[];
};

export type UpdateWorkspaceRoleRequest = CreateWorkspaceRoleRequest;

// ── Workspace Members ─────────────────────────────────────────

export type WorkspaceMemberInfo = z.infer<typeof memberInfoSchema>;

export type WorkspaceUserInfo = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  is_active: boolean;
  color?: string | null;
};
