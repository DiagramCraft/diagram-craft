import { randomUUID } from 'node:crypto';
import { AR_COLOR_BLUE } from '@arch-register/api-types/colors';
import {
  BUILTIN_WORKSPACE_ROLES,
  WORKSPACE_CAPABILITY_GROUPS,
  resolveWorkspaceRoleDefinitions,
  type TeamRole,
  type WorkspaceCapability
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import type {
  LifecycleStateDbResult,
  OwnerDbResult,
  TeamMembershipDbResult,
  RoleDefinitionDbResult,
  MemberDbResult,
  ProjectEntityTypeDbResult
} from './db/workspaceDatabase';

const VALID_TEAM_ROLES: TeamRole[] = ['team_admin', 'team_editor', 'team_reviewer'];
const VALID_WORKSPACE_CAPABILITIES = WORKSPACE_CAPABILITY_GROUPS.flatMap(group =>
  group.caps.map(cap => cap.id)
);

const sanitize = (text: string): string =>
  text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();

// ── Lifecycle States ──────────────────────────────────────────

export const listLifecycleStates = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<LifecycleStateDbResult[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  return await db.workspace.listLifecycleStates(workspace);
};

export const replaceLifecycleStates = async (
  db: DatabaseAdapter,
  workspace: string,
  states: Array<{ id?: string; label: string; color: string; sort_order?: number }>,
  event: AuthenticatedEvent
): Promise<LifecycleStateDbResult[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.settings');

  const now = new Date();
  const normalized = states.map(s => ({
    ...s,
    id: typeof s.id === 'string' && s.id.trim() ? s.id : randomUUID()
  }));
  const ids = normalized.map(s => s.id);
  httpAssert.true(new Set(ids).size === ids.length, { message: 'Duplicate lifecycle state ids' });

  return await db.workspace.replaceLifecycleStates(
    workspace,
    normalized.map((s, i) => ({
      id: s.id,
      workspace,
      label: s.label,
      color: s.color,
      sort_order: i,
      created_at: now
    }))
  );
};

// ── Project Entity Types ──────────────────────────────────────

export const listProjectEntityTypes = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<ProjectEntityTypeDbResult[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  return await db.workspace.listProjectEntityTypes(workspace);
};

export const replaceProjectEntityTypes = async (
  db: DatabaseAdapter,
  workspace: string,
  types: Array<{ id?: string; label: string; sort_order?: number }>,
  event: AuthenticatedEvent
): Promise<ProjectEntityTypeDbResult[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.settings');

  const now = new Date();
  return await db.workspace.replaceProjectEntityTypes(
    workspace,
    types.map((t, i) => ({
      id: typeof t.id === 'string' ? t.id : randomUUID(),
      workspace,
      label: t.label,
      sort_order: t.sort_order ?? i,
      created_at: now
    }))
  );
};

// ── Teams ─────────────────────────────────────────────────────

export const listTeams = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<OwnerDbResult[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');
  return await db.workspace.listTeams(workspace);
};

export const replaceTeams = async (
  db: DatabaseAdapter,
  workspace: string,
  teams: Array<{
    id?: string;
    name: string;
    sort_order?: number;
    color?: string | null;
    description?: string;
  }>,
  event: AuthenticatedEvent
): Promise<OwnerDbResult[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.teams');

  const now = new Date();
  const normalized = teams.map(o => ({
    ...o,
    id: typeof o.id === 'string' ? o.id : randomUUID()
  }));
  const ids = normalized.map(o => o.id);
  httpAssert.true(new Set(ids).size === ids.length, { message: 'Duplicate owner ids' });

  return await db.workspace.replaceTeams(
    workspace,
    normalized.map((o, i) => ({
      id: o.id,
      workspace,
      name: sanitize(o.name),
      sort_order: i,
      color: o.color ?? null,
      description: o.description ?? '',
      created_at: now
    }))
  );
};

// ── Team Assignments ──────────────────────────────────────────

export const listTeamAssignments = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<TeamMembershipDbResult[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.teams');
  return await db.workspace.listTeamAssignments(workspace);
};

export const replaceTeamAssignments = async (
  db: DatabaseAdapter,
  workspace: string,
  assignments: Array<{ team_id: string; user_id: string; role: string }>,
  event: AuthenticatedEvent
): Promise<TeamMembershipDbResult[]> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.teams');

  const owners = new Set((await db.workspace.listTeams(workspace)).map(o => o.id));
  const users = new Set((await db.auth.listUsers()).map(u => u.id));
  const now = new Date();

  const rows = assignments.map(a => {
    httpAssert.true(typeof a.team_id === 'string' && owners.has(a.team_id), {
      message: 'team_id must reference an existing team'
    });
    httpAssert.true(typeof a.user_id === 'string' && users.has(a.user_id), {
      message: 'user_id must reference an existing user'
    });
    httpAssert.true(typeof a.role === 'string' && VALID_TEAM_ROLES.includes(a.role as TeamRole), {
      message: `role must be one of: ${VALID_TEAM_ROLES.join(', ')}`
    });
    return {
      workspace,
      team_id: a.team_id,
      user_id: a.user_id,
      role: a.role as TeamRole,
      created_at: now
    };
  });

  return await db.workspace.replaceTeamAssignments(workspace, rows);
};

// ── Roles ─────────────────────────────────────────────────────

export const listRoles = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.role');
  return resolveWorkspaceRoleDefinitions(await db.workspace.listCustomWorkspaceRoles(workspace));
};

const parseRoleInput = (input: {
  name: string;
  description?: string;
  tone?: string;
  capabilities: string[];
}) => {
  const capabilities = input.capabilities.map(cap => {
    httpAssert.true(VALID_WORKSPACE_CAPABILITIES.includes(cap as WorkspaceCapability), {
      message: 'capabilities contains invalid values'
    });
    return cap as WorkspaceCapability;
  });

  const name = sanitize(input.name);
  const description = input.description !== undefined ? sanitize(input.description) : '';
  const tone = input.tone !== undefined ? input.tone.trim() : AR_COLOR_BLUE;

  httpAssert.true(name.length > 0 && name.length <= 100, {
    message: 'name must be between 1 and 100 characters'
  });
  httpAssert.true(description.length <= 500, {
    message: 'description must not exceed 500 characters'
  });
  httpAssert.true(/^(oklch\(|var\(--[\w-]+\)|#[0-9a-fA-F]{3,8}|rgb|hsl)/.test(tone), {
    message: 'tone must be a valid CSS color value'
  });

  return { name, description, tone, capabilities: [...new Set(capabilities)] };
};

export const createRole = async (
  db: DatabaseAdapter,
  workspace: string,
  input: { name: string; description?: string; tone?: string; capabilities: string[] },
  event: AuthenticatedEvent
): Promise<RoleDefinitionDbResult> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.role');

  const parsed = parseRoleInput(input);
  const now = new Date();
  return await db.workspace.createCustomWorkspaceRole({
    id: randomUUID(),
    workspace,
    name: parsed.name,
    description: parsed.description,
    tone: parsed.tone,
    builtin: false,
    capabilities: parsed.capabilities,
    created_at: now,
    updated_at: now
  });
};

export const updateRole = async (
  db: DatabaseAdapter,
  workspace: string,
  roleId: string,
  input: { name: string; description?: string; tone?: string; capabilities: string[] },
  event: AuthenticatedEvent
): Promise<RoleDefinitionDbResult> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.role');

  httpAssert.true(!BUILTIN_WORKSPACE_ROLES.some(r => r.id === roleId), {
    status: 400,
    message: 'Built-in roles cannot be edited'
  });

  const parsed = parseRoleInput(input);
  const updated = await db.workspace.updateCustomWorkspaceRole(workspace, roleId, {
    name: parsed.name,
    description: parsed.description,
    tone: parsed.tone,
    builtin: false,
    capabilities: parsed.capabilities,
    updated_at: new Date()
  });
  httpAssert.present(updated, { status: 404, message: 'Role not found' });
  return updated!;
};

export const deleteRole = async (
  db: DatabaseAdapter,
  workspace: string,
  roleId: string,
  event: AuthenticatedEvent
): Promise<RoleDefinitionDbResult> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.role');

  httpAssert.true(!BUILTIN_WORKSPACE_ROLES.some(r => r.id === roleId), {
    status: 400,
    message: 'Built-in roles cannot be deleted'
  });

  const memberCount = await db.workspace.countWorkspaceMembersByRole(workspace, roleId);
  httpAssert.true(memberCount === 0, {
    status: 409,
    message: 'Role is still assigned to workspace members'
  });

  const deleted = await db.workspace.deleteCustomWorkspaceRole(workspace, roleId);
  httpAssert.present(deleted, { status: 404, message: 'Role not found' });
  return deleted!;
};

// ── Members ───────────────────────────────────────────────────

export const listMembers = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.invite');

  const members = await db.workspace.listWorkspaceMembers(workspace);
  const users = await db.auth.listUsers();
  const userMap = new Map(users.map(u => [u.id, u]));

  return members.map(m => {
    const user = userMap.get(m.user_id);
    return {
      workspace: m.workspace,
      user_id: m.user_id,
      role: m.role,
      display_name: user?.display_name ?? m.user_id,
      email: user?.email ?? null,
      created_at: m.created_at.toISOString()
    };
  });
};

export const updateMemberRole = async (
  db: DatabaseAdapter,
  workspace: string,
  userId: string,
  role: string,
  event: AuthenticatedEvent
): Promise<MemberDbResult> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.role');

  const [user, customRoles] = await Promise.all([
    db.auth.getUser(userId),
    db.workspace.listCustomWorkspaceRoles(workspace)
  ]);

  httpAssert.present(user, { status: 404, message: 'User not found' });

  const validRoleIds = new Set(resolveWorkspaceRoleDefinitions(customRoles).map(r => r.id));
  httpAssert.true(validRoleIds.has(role), {
    message: 'role must reference an existing workspace role'
  });

  return await db.workspace.setWorkspaceMemberRole(workspace, userId, role, new Date());
};

export const removeMember = async (
  db: DatabaseAdapter,
  workspace: string,
  userId: string,
  event: AuthenticatedEvent
): Promise<MemberDbResult> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.remove');

  const removed = await db.workspace.removeWorkspaceMember(workspace, userId);
  httpAssert.present(removed, { status: 404, message: 'Member not found' });
  return removed!;
};

// ── Users ─────────────────────────────────────────────────────

export const listUsers = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.invite');

  const users = await db.auth.listUsers();
  return users.map(user => ({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    auth_provider: user.auth_provider,
    is_active: user.is_active,
    color: user.color
  }));
};
