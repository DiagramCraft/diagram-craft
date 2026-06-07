import { AR_COLOR_BLUE } from '@arch-register/api-types/colors';
import { randomUUID } from 'node:crypto';
import { H3, defineHandler } from 'h3';
import {
  BUILTIN_WORKSPACE_ROLES,
  WORKSPACE_CAPABILITY_GROUPS,
  resolveWorkspaceRoleDefinitions
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../db/database.js';
import { resolveWorkspace } from '../api-helpers/resolveWorkspace.js';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import type {
  TeamMembership,
  TeamRole,
  WorkspaceLifecycleState,
  WorkspaceOwner,
  WorkspaceRoleCapability
} from '../types.js';
import { httpAssert } from '../utils/httpAssert.js';

const BASE = '/api/:workspace/config';

const VALID_TEAM_ROLES: TeamRole[] = ['team_admin', 'team_editor', 'team_reviewer'];
const VALID_WORKSPACE_CAPABILITIES = WORKSPACE_CAPABILITY_GROUPS.flatMap(group => group.caps.map(cap => cap.id));

export const sanitizeText = (text: string): string => {
  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
};

export const parseWorkspaceRoleInput = (body: unknown) => {
  httpAssert.true(body != null && typeof body === 'object', {
    message: 'Request body must be a JSON object'
  });

  const data = body as Record<string, unknown>;
  httpAssert.string(data['name'], { message: 'name is required and must be a string' });
  if (data['description'] !== undefined) {
    httpAssert.string(data['description'], { message: 'description must be a string if provided' });
  }
  if (data['tone'] !== undefined) {
    httpAssert.string(data['tone'], { message: 'tone must be a string if provided' });
  }
  httpAssert.array(data['capabilities'], { message: 'capabilities must be an array' });

  const capabilities = (data['capabilities'] as unknown[]).map(capability => {
    httpAssert.true(
      typeof capability === 'string' && VALID_WORKSPACE_CAPABILITIES.includes(capability as WorkspaceRoleCapability),
      { message: 'capabilities contains invalid values' }
    );
    return capability as WorkspaceRoleCapability;
  });

  const name = sanitizeText(data['name'] as string);
  const description = data['description'] !== undefined ? sanitizeText(data['description'] as string) : '';
  const tone = data['tone'] !== undefined ? (data['tone'] as string).trim() : AR_COLOR_BLUE;
  
  httpAssert.true(name.length > 0 && name.length <= 100, {
    message: 'name must be between 1 and 100 characters'
  });
  httpAssert.true(description.length <= 500, {
    message: 'description must not exceed 500 characters'
  });
  httpAssert.true(/^(oklch\(|var\(--[\w-]+\)|#[0-9a-fA-F]{3,8}|rgb|hsl)/.test(tone), {
    message: 'tone must be a valid CSS color value'
  });

  return {
    name,
    description,
    tone,
    capabilities: [...new Set(capabilities)],
  };
};

export const buildLifecycleStateInputs = (
  workspace: string,
  body: unknown,
  now: Date
): WorkspaceLifecycleState[] => {
  httpAssert.array(body, { message: 'Request body must be a JSON array' });

  const states = body as Array<{
    id?: unknown;
    label?: unknown;
    color?: unknown;
    sort_order?: unknown;
  }>;
  for (const s of states) {
    httpAssert.string(s.id, { message: 'Each lifecycle state must have a string id' });
    httpAssert.string(s.label, { message: 'Each lifecycle state must have a string label' });
    httpAssert.string(s.color, { message: 'Each lifecycle state must have a string color' });
  }

  const ids = states.map(s => s.id as string);
  httpAssert.true(new Set(ids).size === ids.length, {
    message: 'Duplicate lifecycle state ids'
  });

  return states.map((s, i) => ({
    id: s.id as string,
    workspace,
    label: s.label as string,
    color: s.color as string,
    sort_order: i,
    created_at: now
  }));
};

export const buildWorkspaceOwnerInputs = (
  workspace: string,
  body: unknown,
  now: Date
): WorkspaceOwner[] => {
  httpAssert.array(body, { message: 'Request body must be a JSON array' });

  const owners = body as Array<{
    id?: unknown;
    sort_order?: unknown;
    color?: unknown;
    description?: unknown;
  }>;
  for (const o of owners) {
    httpAssert.string(o.id, { message: 'Each owner must have a string id' });
    if (o.color !== undefined && o.color !== null) {
      httpAssert.string(o.color, { message: 'color must be a string if provided' });
    }
    if (o.description !== undefined) {
      httpAssert.string(o.description, { message: 'description must be a string if provided' });
    }
  }

  const ids = owners.map(o => o.id as string);
  httpAssert.true(new Set(ids).size === ids.length, {
    message: 'Duplicate owner ids'
  });

  return owners.map((o, i) => ({
    id: o.id as string,
    workspace,
    sort_order: i,
    color: (o.color as string | null | undefined) ?? null,
    description: (o.description as string | undefined) ?? '',
    created_at: now
  }));
};

export const buildTeamMembershipInputs = (
  workspace: string,
  body: unknown,
  ownerIds: Set<string>,
  userIds: Set<string>,
  now: Date
): TeamMembership[] => {
  httpAssert.array(body, { message: 'Request body must be a JSON array' });
  const rows = body as unknown[];

  return rows.map(row => {
    httpAssert.true(row != null && typeof row === 'object', {
      message: 'Each membership must be an object'
    });
    const membership = row as Record<string, unknown>;
    const teamId = membership['team_id'];
    httpAssert.true(typeof teamId === 'string' && ownerIds.has(teamId), {
      message: 'team_id must reference an existing team'
    });
    const userId = membership['user_id'];
    httpAssert.true(typeof userId === 'string' && userIds.has(userId), {
      message: 'user_id must reference an existing user'
    });
    const roleValue = membership['role'];
    httpAssert.true(
      typeof roleValue === 'string' && VALID_TEAM_ROLES.includes(roleValue as TeamRole),
      { message: `role must be one of: ${VALID_TEAM_ROLES.join(', ')}` }
    );

    return {
      workspace,
      team_id: teamId as string,
      user_id: userId as string,
      role: roleValue as TeamRole,
      created_at: now
    };
  });
};

export function createWorkspaceConfigRoutes(db: DatabaseAdapter) {
  const router = new H3();

  // GET /api/:workspace/config/lifecycle-states
  router.get(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await db.workspaceAdmin.listLifecycleStates(workspace);
    })
  );

  // PUT /api/:workspace/config/lifecycle-states
  router.put(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.settings');
      const body = await event.req.json().catch(() => undefined);
      const now = new Date();
      return await db.workspaceAdmin.replaceLifecycleStates(
        workspace,
        buildLifecycleStateInputs(workspace, body, now)
      );
    })
  );

  // GET /api/:workspace/config/teams
  router.get(
    `${BASE}/teams`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await db.workspaceAdmin.listTeams(workspace);
    })
  );

  // GET /api/:workspace/config/owners
  router.get(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await db.workspaceAdmin.listTeams(workspace);
    })
  );

  router.get(
    `${BASE}/roles`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.role');
      return resolveWorkspaceRoleDefinitions(await db.workspaceAdmin.listCustomWorkspaceRoles(workspace));
    })
  );

  router.post(
    `${BASE}/roles`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.role');
      const body = await event.req.json().catch(() => undefined);
      const input = parseWorkspaceRoleInput(body);
      httpAssert.true(input.name.length > 0, { message: 'name is required' });

      const now = new Date();
      return await db.workspaceAdmin.createCustomWorkspaceRole({
        id: randomUUID(),
        workspace,
        name: input.name,
        description: input.description,
        tone: input.tone,
        builtin: false,
        capabilities: input.capabilities,
        created_at: now,
        updated_at: now,
      });
    })
  );

  router.put(
    `${BASE}/roles/:roleId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.role');

      const roleId = event.context.params?.['roleId'];
      httpAssert.string(roleId, { message: 'roleId is required' });
      httpAssert.true(!BUILTIN_WORKSPACE_ROLES.some(role => role.id === roleId), {
        status: 400,
        message: 'Built-in roles cannot be edited'
      });

      const body = await event.req.json().catch(() => undefined);
      const input = parseWorkspaceRoleInput(body);
      httpAssert.true(input.name.length > 0, { message: 'name is required' });

      const updated = await db.workspaceAdmin.updateCustomWorkspaceRole(workspace, roleId, {
        name: input.name,
        description: input.description,
        tone: input.tone,
        builtin: false,
        capabilities: input.capabilities,
        updated_at: new Date(),
      });
      httpAssert.present(updated, { status: 404, message: 'Role not found' });
      return updated;
    })
  );

  router.delete(
    `${BASE}/roles/:roleId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.role');

      const roleId = event.context.params?.['roleId'];
      httpAssert.string(roleId, { message: 'roleId is required' });
      httpAssert.true(!BUILTIN_WORKSPACE_ROLES.some(role => role.id === roleId), {
        status: 400,
        message: 'Built-in roles cannot be deleted'
      });

      const memberCount = await db.workspaceAdmin.countWorkspaceMembersByRole(workspace, roleId);
      httpAssert.true(memberCount === 0, {
        status: 409,
        message: 'Role is still assigned to workspace members'
      });

      const deleted = await db.workspaceAdmin.deleteCustomWorkspaceRole(workspace, roleId);
      httpAssert.present(deleted, { status: 404, message: 'Role not found' });
      return deleted;
    })
  );

  // PUT /api/:workspace/config/teams
  router.put(
    `${BASE}/teams`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      const body = await event.req.json().catch(() => undefined);
      const now = new Date();
      return await db.workspaceAdmin.replaceTeams(workspace, buildWorkspaceOwnerInputs(workspace, body, now));
    })
  );

  // PUT /api/:workspace/config/owners
  router.put(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      const body = await event.req.json().catch(() => undefined);
      const now = new Date();
      return await db.workspaceAdmin.replaceTeams(workspace, buildWorkspaceOwnerInputs(workspace, body, now));
    })
  );

  router.get(
    `${BASE}/team-assignments`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      return await db.workspaceAdmin.listTeamAssignments(workspace);
    })
  );

  router.get(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      return await db.workspaceAdmin.listTeamAssignments(workspace);
    })
  );

  router.put(
    `${BASE}/team-assignments`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      const body = await event.req.json().catch(() => undefined);
      const owners = new Set((await db.workspaceAdmin.listTeams(workspace)).map(owner => owner.id));
      const users = new Set((await db.identityAuth.listUsers()).map(user => user.id));
      const now = new Date();
      return await db.workspaceAdmin.replaceTeamAssignments(
        workspace,
        buildTeamMembershipInputs(workspace, body, owners, users, now)
      );
    })
  );

  router.put(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      const body = await event.req.json().catch(() => undefined);
      const owners = new Set((await db.workspaceAdmin.listTeams(workspace)).map(owner => owner.id));
      const users = new Set((await db.identityAuth.listUsers()).map(user => user.id));
      const now = new Date();
      return await db.workspaceAdmin.replaceTeamAssignments(
        workspace,
        buildTeamMembershipInputs(workspace, body, owners, users, now)
      );
    })
  );

  // GET /api/:workspace/config/members
  router.get(
    `${BASE}/members`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.invite');
      const members = await db.workspaceAdmin.listWorkspaceMembers(workspace);
      const users = await db.identityAuth.listUsers();
      const userMap = new Map(users.map(u => [u.id, u]));
      return members.map(m => {
        const user = userMap.get(m.user_id);
        return {
          workspace: m.workspace,
          user_id: m.user_id,
          role: m.role,
          display_name: user?.display_name ?? m.user_id,
          email: user?.email ?? null,
          created_at: m.created_at.toISOString(),
        };
      });
    })
  );

  // GET /api/:workspace/config/users
  router.get(
    `${BASE}/users`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.invite');

      const users = await db.identityAuth.listUsers();
      return users.map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        auth_provider: user.auth_provider,
        is_active: user.is_active,
        color: user.color,
      }));
    })
  );

  // PUT /api/:workspace/config/members/:userId/role
  router.put(
    `${BASE}/members/:userId/role`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.role');

      const userId = event.context.params?.['userId'];
      httpAssert.string(userId, { message: 'userId is required' });

      const body = (await event.req.json().catch(() => undefined)) as { role?: unknown } | undefined;
      const role = body?.role;
      httpAssert.string(role, { message: 'role is required and must be a string' });

      const [user, customRoles] = await Promise.all([
        db.identityAuth.getUser(userId),
        db.workspaceAdmin.listCustomWorkspaceRoles(workspace)
      ]);
      
      httpAssert.present(user, { status: 404, message: 'User not found' });
      
      const validRoleIds = new Set(resolveWorkspaceRoleDefinitions(customRoles).map(r => r.id));
      httpAssert.true(
        validRoleIds.has(role),
        { message: 'role must reference an existing workspace role' }
      );

      const member = await db.workspaceAdmin.setWorkspaceMemberRole(
        workspace,
        userId,
        role,
        new Date()
      );
      return member;
    })
  );

  // DELETE /api/:workspace/config/members/:userId
  router.delete(
    `${BASE}/members/:userId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.remove');

      const userId = event.context.params?.['userId'];
      httpAssert.string(userId, { message: 'userId is required' });

      const removed = await db.workspaceAdmin.removeWorkspaceMember(workspace, userId);
      httpAssert.present(removed, { status: 404, message: 'Member not found' });
      return removed;
    })
  );

  return router;
}
