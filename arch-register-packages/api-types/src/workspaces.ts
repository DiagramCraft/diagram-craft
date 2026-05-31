// ── Workspace Types ───────────────────────────────────────────

export type Workspace = {
  id: string;
  name: string;
  url_slug: string;
  short_code: string;
  description: string;
  created_at: string;
  updated_at: string;
};

// ── Request Types ─────────────────────────────────────────────

export type CreateWorkspaceRequest = {
  name: string;
  description?: string;
};

export type UpdateWorkspaceRequest = Partial<CreateWorkspaceRequest>;

// ── Workspace Configuration ───────────────────────────────────

export type WorkspaceLifecycleState = {
  id: string;
  label: string;
  color: string;
  sort_order: number;
};

export type WorkspaceOwnerOption = {
  id: string;
  sort_order: number;
};

// ── Workspace Members ─────────────────────────────────────────

export type WorkspaceMemberInfo = {
  workspace: string;
  user_id: string;
  role: string;
  display_name: string;
  email: string | null;
  created_at: string;
};

export type WorkspaceUserInfo = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  is_active: boolean;
};
