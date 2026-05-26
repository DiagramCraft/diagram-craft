import { H3, HTTPError, defineHandler } from 'h3';
import sql from '../db/client.js';
import type { WorkspaceLifecycleState, WorkspaceOwner } from '../types.js';
import { resolveWorkspace } from './workspace-resolver.js';

const BASE = '/api/:workspace/config';

export function createWorkspaceConfigRoutes() {
  const router = new H3();

  // GET /api/:workspace/config/lifecycle-states
  router.get(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      const rows = await sql<WorkspaceLifecycleState[]>`
        SELECT id, label, color, sort_order
        FROM workspace_lifecycle_state
        WHERE workspace = ${workspace}
        ORDER BY sort_order, id
      `;
      return rows;
    })
  );

  // PUT /api/:workspace/config/lifecycle-states
  router.put(
    `${BASE}/lifecycle-states`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
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

      await sql.begin(async tx => {
        await tx`DELETE FROM workspace_lifecycle_state WHERE workspace = ${workspace}`;
        for (let i = 0; i < states.length; i++) {
          const s = states[i]!;
          await tx`
            INSERT INTO workspace_lifecycle_state (id, workspace, label, color, sort_order)
            VALUES (${s.id as string}, ${workspace}, ${s.label as string}, ${s.color as string}, ${i})
          `;
        }
      });

      const rows = await sql<WorkspaceLifecycleState[]>`
        SELECT id, label, color, sort_order
        FROM workspace_lifecycle_state
        WHERE workspace = ${workspace}
        ORDER BY sort_order, id
      `;
      return rows;
    })
  );

  // GET /api/:workspace/config/owners
  router.get(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      const rows = await sql<WorkspaceOwner[]>`
        SELECT id, sort_order
        FROM workspace_owner
        WHERE workspace = ${workspace}
        ORDER BY sort_order, id
      `;
      return rows;
    })
  );

  // PUT /api/:workspace/config/owners
  router.put(
    `${BASE}/owners`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
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

      await sql.begin(async tx => {
        await tx`DELETE FROM workspace_owner WHERE workspace = ${workspace}`;
        for (let i = 0; i < owners.length; i++) {
          const o = owners[i]!;
          await tx`
            INSERT INTO workspace_owner (id, workspace, sort_order)
            VALUES (${o.id as string}, ${workspace}, ${i})
          `;
        }
      });

      const rows = await sql<WorkspaceOwner[]>`
        SELECT id, sort_order
        FROM workspace_owner
        WHERE workspace = ${workspace}
        ORDER BY sort_order, id
      `;
      return rows;
    })
  );

  return router;
}
