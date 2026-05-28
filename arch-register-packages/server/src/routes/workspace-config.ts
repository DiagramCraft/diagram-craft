import { H3, HTTPError, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { buildAuthorizationContextForEvent, requireGlobalPermission } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';

const BASE = '/api/:workspace/config';

export function createWorkspaceConfigRoutes(db: DatabaseAdapter) {
  const router = new H3();

  // GET /api/:workspace/config/lifecycle-states
  router.get(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authz = await buildAuthorizationContextForEvent(db, workspace, event as AuthenticatedEvent);
      if (authz) requireGlobalPermission(authz, 'view_schema');
      return await db.listLifecycleStates(workspace);
    })
  );

  // PUT /api/:workspace/config/lifecycle-states
  router.put(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authz = await buildAuthorizationContextForEvent(db, workspace, event as AuthenticatedEvent);
      if (authz) requireGlobalPermission(authz, 'edit_schema');
      const body = await event.req.json().catch(() => undefined);
      if (!Array.isArray(body))
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON array' });

      const states = body as Array<{ id?: unknown; label?: unknown; color?: unknown; sort_order?: unknown }>;
      for (const s of states) {
        if (!s.id || typeof s.id !== 'string')
          throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Each lifecycle state must have a string id' });
        if (!s.label || typeof s.label !== 'string')
          throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Each lifecycle state must have a string label' });
        if (!s.color || typeof s.color !== 'string')
          throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Each lifecycle state must have a string color' });
      }

      const ids = states.map(s => s.id as string);
      if (new Set(ids).size !== ids.length)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Duplicate lifecycle state ids' });

      const now = new Date();
      return await db.replaceLifecycleStates(
        workspace,
        states.map((s, i) => ({
          id: s.id as string,
          workspace,
          label: s.label as string,
          color: s.color as string,
          sort_order: i,
          created_at: now,
        })),
      );
    })
  );

  // GET /api/:workspace/config/owners
  router.get(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authz = await buildAuthorizationContextForEvent(db, workspace, event as AuthenticatedEvent);
      if (authz) requireGlobalPermission(authz, 'manage_teams');
      return await db.listOwners(workspace);
    })
  );

  // PUT /api/:workspace/config/owners
  router.put(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authz = await buildAuthorizationContextForEvent(db, workspace, event as AuthenticatedEvent);
      if (authz) requireGlobalPermission(authz, 'manage_teams');
      const body = await event.req.json().catch(() => undefined);
      if (!Array.isArray(body))
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON array' });

      const owners = body as Array<{ id?: unknown; sort_order?: unknown }>;
      for (const o of owners) {
        if (!o.id || typeof o.id !== 'string')
          throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Each owner must have a string id' });
      }

      const ids = owners.map(o => o.id as string);
      if (new Set(ids).size !== ids.length)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Duplicate owner ids' });

      const now = new Date();
      return await db.replaceOwners(
        workspace,
        owners.map((o, i) => ({
          id: o.id as string,
          workspace,
          sort_order: i,
          created_at: now,
        })),
      );
    })
  );

  router.get(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authz = await buildAuthorizationContextForEvent(db, workspace, event as AuthenticatedEvent);
      if (authz) requireGlobalPermission(authz, 'manage_teams');
      return await db.listTeamMemberships(workspace);
    })
  );

  router.put(
    `${BASE}/team-memberships`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authz = await buildAuthorizationContextForEvent(db, workspace, event as AuthenticatedEvent);
      if (authz) requireGlobalPermission(authz, 'manage_teams');
      const body = await event.req.json().catch(() => undefined);
      if (!Array.isArray(body)) {
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Request body must be a JSON array' });
      }

      const owners = new Set((await db.listOwners(workspace)).map(owner => owner.id));
      const users = new Set((await db.listUsers()).map(user => user.id));
      const now = new Date();
      const memberships = body.map(row => {
        if (row == null || typeof row !== 'object') {
          throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'Each membership must be an object' });
        }
        const membership = row as Record<string, unknown>;
        if (typeof membership['team_id'] !== 'string' || !owners.has(membership['team_id'])) {
          throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'team_id must reference an existing team' });
        }
        if (typeof membership['user_id'] !== 'string' || !users.has(membership['user_id'])) {
          throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'user_id must reference an existing user' });
        }
        return {
          workspace,
          team_id: membership['team_id'],
          user_id: membership['user_id'],
          created_at: now,
        };
      });

      return await db.replaceTeamMemberships(workspace, memberships);
    })
  );

  return router;
}
