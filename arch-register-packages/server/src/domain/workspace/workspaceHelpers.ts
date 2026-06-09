import type {
  Workspace,
  WorkspaceLifecycleState,
  WorkspaceOwnerOption,
  WorkspaceMemberInfo,
  WorkspaceUserInfo
} from '@arch-register/api-types';
import {
  WorkspaceOwnerRow,
  WorkspaceMemberRow,
  WorkspaceRow,
  WorkspaceLifecycleStateRow as InternalWorkspaceLifecycleState
} from './db/workspaceDatabase';
import { UserRow } from '@arch-register/server/domain/auth/db/authDatabase';

export const toApiWorkspace = (workspace: WorkspaceRow): Workspace => ({
  id: workspace.id,
  name: workspace.name,
  url_slug: workspace.url_slug,
  short_code: workspace.short_code,
  color: workspace.color,
  description: workspace.description,
  created_at: workspace.created_at.toISOString(),
  updated_at: workspace.updated_at.toISOString()
});

export const toApiLifecycleState = (
  state: InternalWorkspaceLifecycleState
): WorkspaceLifecycleState => ({
  id: state.id,
  label: state.label,
  color: state.color,
  sort_order: state.sort_order
});

export const toApiOwnerOption = (owner: WorkspaceOwnerRow): WorkspaceOwnerOption => ({
  id: owner.id,
  name: owner.name,
  sort_order: owner.sort_order,
  color: owner.color,
  description: owner.description
});

export const toApiWorkspaceMember = (
  member: WorkspaceMemberRow,
  user: UserRow
): WorkspaceMemberInfo => ({
  workspace: member.workspace,
  user_id: member.user_id,
  role: member.role,
  display_name: user.display_name,
  email: user.email,
  created_at: member.created_at.toISOString()
});

export const toApiWorkspaceUser = (user: UserRow): WorkspaceUserInfo => ({
  id: user.id,
  user_id: user.user_id,
  email: user.email,
  display_name: user.display_name,
  auth_provider: user.auth_provider,
  is_active: user.is_active
});
