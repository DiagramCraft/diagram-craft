import { H3, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import type { WorkspaceRole } from '../types.js';
import { httpAssert } from '../utils/httpAssert.js';

const BASE = '/api/:workspace/config';

const VALID_WORKSPACE_ROLES: WorkspaceRole[] = ['owner', 'admin', 'editor', 'reviewer', 'viewer'];

export function createWorkspaceConfigRoutes(db: DatabaseAdapter) {
  const router = new H3();

  // GET /api/:workspace/config/lifecycle-states
  router.get(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await db.workspaceAdmin.listLifecycleStates(workspace);
    })
  );

  // PUT /api/:workspace/config/lifecycle-states
  router.put(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.settings');
      const body = await event.req.json().catch(() => undefined);
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

      const now = new Date();
      return await db.workspaceAdmin.replaceLifecycleStates(
        workspace,
        states.map((s, i) => ({
          id: s.id as string,
          workspace,
          label: s.label as string,
          color: s.color as string,
          sort_order: i,
          created_at: now
        }))
      );
    })
  );

  // GET /api/:workspace/config/owners
  router.get(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      return await db.workspaceAdmin.listOwners(workspace);
    })
  );

  // PUT /api/:workspace/config/owners
  router.put(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.array(body, { message: 'Request body must be a JSON array' });

      const owners = body as Array<{ id?: unknown; sort_order?: unknown }>;
      for (const o of owners) {
        httpAssert.string(o.id, { message: 'Each owner must have a string id' });
      }

      const ids = owners.map(o => o.id as string);
      httpAssert.true(new Set(ids).size === ids.length, {
        message: 'Duplicate owner ids'
      });

      const now = new Date();
      return await db.workspaceAdmin.replaceOwners(
        workspace,
        owners.map((o, i) => ({
          id: o.id as string,
          workspace,
          sort_order: i,
          created_at: now
        }))
      );
    })
  );

  router.get(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      return await db.workspaceAdmin.listTeamMemberships(workspace);
    })
  );

  router.put(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.teams');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.array(body, { message: 'Request body must be a JSON array' });
      const rows = body as unknown[];

      const owners = new Set((await db.workspaceAdmin.listOwners(workspace)).map(owner => owner.id));
      const users = new Set((await db.identityAuth.listUsers()).map(user => user.id));
      const now = new Date();
      const memberships: Array<{
        workspace: string;
        team_id: string;
        user_id: string;
        created_at: Date;
      }> = rows.map(row => {
        httpAssert.true(row != null && typeof row === 'object', {
          message: 'Each membership must be an object'
        });
        const membership = row as Record<string, unknown>;
        const teamId = membership['team_id'];
        httpAssert.true(typeof teamId === 'string' && owners.has(teamId), {
          message: 'team_id must reference an existing team'
        });
        const userId = membership['user_id'];
        httpAssert.true(typeof userId === 'string' && users.has(userId), {
          message: 'user_id must reference an existing user'
        });
        return {
          workspace,
          team_id: teamId as string,
          user_id: userId as string,
          created_at: now
        };
      });

      return await db.workspaceAdmin.replaceTeamMemberships(workspace, memberships);
    })
  );

  // GET /api/:workspace/config/members
  router.get(
    `${BASE}/members`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.invite');

      const users = await db.identityAuth.listUsers();
      return users.map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        auth_provider: user.auth_provider,
        is_active: user.is_active,
      }));
    })
  );

  // PUT /api/:workspace/config/members/:userId/role
  router.put(
    `${BASE}/members/:userId/role`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'people.role');

      const userId = event.context.params?.['userId'];
      httpAssert.string(userId, { message: 'userId is required' });

      const body = (await event.req.json().catch(() => undefined)) as { role?: unknown } | undefined;
      const role = body?.role;
      httpAssert.true(
        typeof role === 'string' && VALID_WORKSPACE_ROLES.includes(role as WorkspaceRole),
        { message: `role must be one of: ${VALID_WORKSPACE_ROLES.join(', ')}` }
      );

      const user = await db.identityAuth.getUser(userId);
      httpAssert.present(user, { status: 404, message: 'User not found' });

      const member = await db.workspaceAdmin.setWorkspaceMemberRole(
        workspace,
        userId,
        role as WorkspaceRole,
        new Date()
      );
      return member;
    })
  );

  // DELETE /api/:workspace/config/members/:userId
  router.delete(
    `${BASE}/members/:userId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
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
