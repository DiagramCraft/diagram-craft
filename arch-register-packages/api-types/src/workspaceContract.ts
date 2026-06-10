import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url_slug: z.string(),
  short_code: z.string(),
  color: z.string(),
  description: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

// ── Request schemas ───────────────────────────────────────────

export const listWorkspacesRequestSchema = z.object({});

export const createWorkspaceRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  slug: z.string().optional(),
  badge: z.string().optional(),
  template: z.string().optional(),
  replicate_from: z.string().optional(),
  include: z.array(z.string()).optional()
});

export const updateWorkspaceRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  url_slug: z.string().optional(),
  short_code: z.string().optional(),
  color: z.string().optional()
});

export const deleteWorkspaceRequestSchema = z.object({
  id: z.string()
});

const deleteWorkspaceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

const workspaceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string()
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceManagementContract = {
  workspaces: {
    list: oc
      .route({ method: 'GET', path: '/workspaces' })
      .input(listWorkspacesRequestSchema)
      .output(z.array(workspaceSchema)),
    create: oc
      .route({ method: 'POST', path: '/workspaces' })
      .input(createWorkspaceRequestSchema)
      .output(workspaceSchema),
    update: oc
      .route({ method: 'PUT', path: '/workspaces/{id}' })
      .input(updateWorkspaceRequestSchema)
      .output(workspaceSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/workspaces/{id}' })
      .input(deleteWorkspaceRequestSchema)
      .output(deleteWorkspaceResponseSchema),
    templates: oc
      .route({ method: 'GET', path: '/workspaces/templates' })
      .input(z.object({}))
      .output(z.array(workspaceTemplateSchema))
  }
};

// ── Workspace Types ───────────────────────────────────────────

export type Workspace = z.infer<typeof workspaceSchema>;

// ── Request Types ─────────────────────────────────────────────

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

export type WorkspaceUserInfo = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  is_active: boolean;
  color?: string | null;
};
