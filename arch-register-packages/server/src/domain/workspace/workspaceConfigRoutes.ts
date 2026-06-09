import { AR_COLOR_BLUE } from '@arch-register/api-types/colors';
import { randomUUID } from 'node:crypto';
import { H3, defineHandler } from 'h3';
import {
  WORKSPACE_CAPABILITY_GROUPS,
  TeamRole,
  WorkspaceCapability
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { resolveWorkspace } from './resolveWorkspace';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import {
  TeamMembershipDbResult,
  OwnerDbResult,
  LifecycleStateDbResult
} from './db/workspaceDatabase';
import {
  listLifecycleStates,
  replaceLifecycleStates,
  listTeams,
  replaceTeams,
  listTeamAssignments,
  replaceTeamAssignments,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listMembers,
  updateMemberRole,
  removeMember,
  listUsers
} from './workspaceConfigOperations';

const BASE = '/api/:workspace/config';

// Raw-body adapters: the REST API accepts array bodies directly, operations expect typed arrays
const replaceLifecycleStatesFromRawBody = async (
  db: DatabaseAdapter,
  workspace: string,
  body: unknown,
  event: AuthenticatedEvent
) => {
  const states = buildLifecycleStateInputs(workspace, body, new Date());
  return await replaceLifecycleStates(
    db,
    workspace,
    states.map(s => ({ id: s.id, label: s.label, color: s.color, sort_order: s.sort_order })),
    event
  );
};

const replaceTeamsFromRawBody = async (
  db: DatabaseAdapter,
  workspace: string,
  body: unknown,
  event: AuthenticatedEvent
) => {
  const teams = buildWorkspaceOwnerInputs(workspace, body, new Date());
  return await replaceTeams(
    db,
    workspace,
    teams.map(t => ({ id: t.id, name: t.name, color: t.color, description: t.description })),
    event
  );
};

const replaceTeamAssignmentsFromRawBody = async (
  db: DatabaseAdapter,
  workspace: string,
  body: unknown,
  event: AuthenticatedEvent
) => {
  const owners = new Set((await db.workspace.listTeams(workspace)).map(o => o.id));
  const users = new Set((await db.auth.listUsers()).map(u => u.id));
  const assignments = buildTeamMembershipInputs(workspace, body, owners, users, new Date());
  return await replaceTeamAssignments(
    db,
    workspace,
    assignments.map(a => ({ team_id: a.team_id, user_id: a.user_id, role: a.role })),
    event
  );
};

const VALID_TEAM_ROLES: TeamRole[] = ['team_admin', 'team_editor', 'team_reviewer'];
const VALID_WORKSPACE_CAPABILITIES = WORKSPACE_CAPABILITY_GROUPS.flatMap(group =>
  group.caps.map(cap => cap.id)
);

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
      typeof capability === 'string' &&
        VALID_WORKSPACE_CAPABILITIES.includes(capability as WorkspaceCapability),
      { message: 'capabilities contains invalid values' }
    );
    return capability as WorkspaceCapability;
  });

  const name = sanitizeText(data['name'] as string);
  const description =
    data['description'] !== undefined ? sanitizeText(data['description'] as string) : '';
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
    capabilities: [...new Set(capabilities)]
  };
};

export const buildLifecycleStateInputs = (
  workspace: string,
  body: unknown,
  now: Date
): LifecycleStateDbResult[] => {
  httpAssert.array(body, { message: 'Request body must be a JSON array' });

  const states = body as Array<{
    id?: unknown;
    label?: unknown;
    color?: unknown;
    sort_order?: unknown;
  }>;
  for (const s of states) {
    httpAssert.string(s.label, { message: 'Each lifecycle state must have a string label' });
    httpAssert.string(s.color, { message: 'Each lifecycle state must have a string color' });
    if (s.id !== undefined) {
      httpAssert.string(s.id, { message: 'Each lifecycle state id must be a string if provided' });
    }
  }

  const normalizedStates = states.map(s => ({
    ...s,
    id: typeof s.id === 'string' ? s.id : randomUUID()
  }));
  const ids = normalizedStates.map(s => s.id);
  httpAssert.true(new Set(ids).size === ids.length, {
    message: 'Duplicate lifecycle state ids'
  });

  return normalizedStates.map((s, i) => ({
    id: s.id,
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
): OwnerDbResult[] => {
  httpAssert.array(body, { message: 'Request body must be a JSON array' });

  const owners = body as Array<{
    id?: unknown;
    name?: unknown;
    sort_order?: unknown;
    color?: unknown;
    description?: unknown;
  }>;
  for (const o of owners) {
    if (o.id !== undefined) {
      httpAssert.string(o.id, { message: 'Each owner id must be a string if provided' });
    }
    httpAssert.string(o.name, { message: 'Each owner must have a string name' });
    if (o.color !== undefined && o.color !== null) {
      httpAssert.string(o.color, { message: 'color must be a string if provided' });
    }
    if (o.description !== undefined) {
      httpAssert.string(o.description, { message: 'description must be a string if provided' });
    }
  }

  const normalizedOwners = owners.map(o => ({
    ...o,
    id: typeof o.id === 'string' ? o.id : randomUUID()
  }));
  const ids = normalizedOwners.map(o => o.id);
  httpAssert.true(new Set(ids).size === ids.length, {
    message: 'Duplicate owner ids'
  });

  return normalizedOwners.map((o, i) => ({
    id: o.id,
    workspace,
    name: sanitizeText(o.name as string),
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
): TeamMembershipDbResult[] => {
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

  router.get(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listLifecycleStates(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.put(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const body = await event.req.json().catch(() => undefined);
      return await replaceLifecycleStatesFromRawBody(
        db,
        workspace,
        body,
        event as AuthenticatedEvent
      );
    })
  );

  router.get(
    `${BASE}/teams`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listTeams(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.get(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listTeams(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.put(
    `${BASE}/teams`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const body = await event.req.json().catch(() => undefined);
      return await replaceTeamsFromRawBody(db, workspace, body, event as AuthenticatedEvent);
    })
  );

  router.put(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const body = await event.req.json().catch(() => undefined);
      return await replaceTeamsFromRawBody(db, workspace, body, event as AuthenticatedEvent);
    })
  );

  router.get(
    `${BASE}/roles`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listRoles(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.post(
    `${BASE}/roles`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const body = await event.req.json().catch(() => undefined);
      const input = parseWorkspaceRoleInput(body);
      return await createRole(db, workspace, input, event as AuthenticatedEvent);
    })
  );

  router.put(
    `${BASE}/roles/:roleId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const roleId = event.context.params?.['roleId'];
      httpAssert.string(roleId, { message: 'roleId is required' });
      const body = await event.req.json().catch(() => undefined);
      const input = parseWorkspaceRoleInput(body);
      return await updateRole(db, workspace, roleId, input, event as AuthenticatedEvent);
    })
  );

  router.delete(
    `${BASE}/roles/:roleId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const roleId = event.context.params?.['roleId'];
      httpAssert.string(roleId, { message: 'roleId is required' });
      return await deleteRole(db, workspace, roleId, event as AuthenticatedEvent);
    })
  );

  router.get(
    `${BASE}/team-assignments`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listTeamAssignments(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.get(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listTeamAssignments(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.put(
    `${BASE}/team-assignments`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const body = await event.req.json().catch(() => undefined);
      return await replaceTeamAssignmentsFromRawBody(
        db,
        workspace,
        body,
        event as AuthenticatedEvent
      );
    })
  );

  router.put(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const body = await event.req.json().catch(() => undefined);
      return await replaceTeamAssignmentsFromRawBody(
        db,
        workspace,
        body,
        event as AuthenticatedEvent
      );
    })
  );

  router.get(
    `${BASE}/members`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listMembers(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.get(
    `${BASE}/users`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      return await listUsers(db, workspace, event as AuthenticatedEvent);
    })
  );

  router.put(
    `${BASE}/members/:userId/role`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const userId = event.context.params?.['userId'];
      httpAssert.string(userId, { message: 'userId is required' });
      const body = (await event.req.json().catch(() => undefined)) as
        | { role?: unknown }
        | undefined;
      const role = body?.role;
      httpAssert.string(role, { message: 'role is required and must be a string' });
      return await updateMemberRole(db, workspace, userId, role, event as AuthenticatedEvent);
    })
  );

  router.delete(
    `${BASE}/members/:userId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const userId = event.context.params?.['userId'];
      httpAssert.string(userId, { message: 'userId is required' });
      return await removeMember(db, workspace, userId, event as AuthenticatedEvent);
    })
  );

  return router;
}
