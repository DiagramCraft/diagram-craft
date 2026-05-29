import { H3, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { buildApiAuthCtx, requireGlobalPermission } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { httpAssert } from '../utils/httpAssert.js';

const BASE = '/api/:workspace/config';

export function createWorkspaceConfigRoutes(db: DatabaseAdapter) {
  const router = new H3();

  // GET /api/:workspace/config/lifecycle-states
  router.get(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'view_schema');
      return await db.listLifecycleStates(workspace);
    })
  );

  // PUT /api/:workspace/config/lifecycle-states
  router.put(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'edit_schema');
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
      return await db.replaceLifecycleStates(
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
      return await db.listOwners(workspace);
    })
  );

  // PUT /api/:workspace/config/owners
  router.put(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'manage_teams');
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
      return await db.replaceOwners(
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
      if (authCtx) requireGlobalPermission(authCtx, 'manage_teams');
      return await db.listTeamMemberships(workspace);
    })
  );

  router.put(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'manage_teams');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.array(body, { message: 'Request body must be a JSON array' });
      const rows = body as unknown[];

      const owners = new Set((await db.listOwners(workspace)).map(owner => owner.id));
      const users = new Set((await db.listUsers()).map(user => user.id));
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

      return await db.replaceTeamMemberships(workspace, memberships);
    })
  );

  return router;
}
