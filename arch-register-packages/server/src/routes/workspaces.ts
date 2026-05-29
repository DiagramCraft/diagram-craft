import { H3, HTTPError, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import type { Workspace } from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { handleDbError, slugify } from '../utils/http.js';
import type { StorageAdapter } from '../storage/storage.js';
import { buildApiAuthCtx, requireGlobalPermission } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';

const BASE = '/api/workspaces';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, { unique: 'A workspace with that name already exists' });

const shortCode = (name: string): string =>
  name
    .split(/\s+/)
    .map(w => (w[0] ?? '').toUpperCase())
    .join('')
    .slice(0, 2);

export function createWorkspaceRoutes(db: DatabaseAdapter, storage?: StorageAdapter) {
  const router = new H3();

  // GET /api/workspaces
  router.get(
    BASE,
    defineHandler(async () => {
      try {
        return (await db.listWorkspaces()) as Workspace[];
      } catch (e) {
        handleError(e, 'Failed to retrieve workspaces');
      }
    })
  );

  // POST /api/workspaces
  router.post(
    BASE,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'admin_platform');
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });
      const { name, description = '' } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'name is required and must be a string'
        });
      const id = slugify(name);
      if (!id)
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'name must contain at least one alphanumeric character'
        });
      const urlSlug = id;
      const sc = shortCode(name as string);
      try {
        const timestamp = new Date();
        const row = await db.createWorkspace({
          id,
          name: name as string,
          url_slug: urlSlug,
          short_code: sc,
          description: typeof description === 'string' ? description : '',
          created_at: timestamp,
          updated_at: timestamp
        });

        // Seed default lifecycle states
        await db.replaceLifecycleStates(id, [
          {
            id: 'proposed',
            workspace: id,
            label: 'Proposed',
            color: 'var(--accent)',
            sort_order: 0,
            created_at: timestamp
          },
          {
            id: 'experimental',
            workspace: id,
            label: 'Experimental',
            color: 'var(--accent)',
            sort_order: 1,
            created_at: timestamp
          },
          {
            id: 'production',
            workspace: id,
            label: 'Production',
            color: 'var(--ok)',
            sort_order: 2,
            created_at: timestamp
          },
          {
            id: 'deprecated',
            workspace: id,
            label: 'Deprecated',
            color: 'var(--warn)',
            sort_order: 3,
            created_at: timestamp
          }
        ]);

        // Seed default owners
        await db.replaceOwners(id, [
          { id: 'platform-team', workspace: id, sort_order: 0, created_at: timestamp },
          { id: 'ux-team', workspace: id, sort_order: 1, created_at: timestamp },
          { id: 'security-team', workspace: id, sort_order: 2, created_at: timestamp }
        ]);

        // Log audit entry
        await logAudit(db, {
          workspace: row!.id,
          operation: 'create',
          entityType: 'workspace',
          entityId: row!.id,
          entityName: row!.name,
          changes: {
            new: extractEntityFields(row!)
          }
        });

        return row!;
      } catch (e) {
        handleError(e, 'Failed to create workspace');
      }
    })
  );

  // PUT /api/workspaces/:id
  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'admin_platform');
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });
      const { name, description, url_slug, short_code: sc } = body as Record<string, unknown>;
      if (!name || typeof name !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'name is required and must be a string'
        });
      if (url_slug != null && typeof url_slug === 'string') {
        const cleaned = slugify(url_slug);
        if (!cleaned)
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'url_slug must contain at least one alphanumeric character'
          });
      }
      try {
        // Fetch old state for audit log
        const oldRow = await db.getWorkspace(id);
        if (!oldRow)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Workspace '${id}' not found`
          });

        const row = await db.updateWorkspace(id, {
          name: name as string,
          url_slug: typeof url_slug === 'string' ? slugify(url_slug) : oldRow.url_slug,
          short_code: typeof sc === 'string' ? sc : oldRow.short_code,
          description: typeof description === 'string' ? description : oldRow.description,
          updated_at: new Date()
        });

        // Log audit entry with field-level changes
        const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row!));

        await logAudit(db, {
          workspace: id,
          operation: 'update',
          entityType: 'workspace',
          entityId: id,
          entityName: row!.name,
          changes
        });

        return row!;
      } catch (e) {
        handleError(e, 'Failed to update workspace');
      }
    })
  );

  // DELETE /api/workspaces/:id
  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'admin_platform');
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });

      try {
        const { workspace, projectIds } = await db.deleteWorkspace(id);
        if (!workspace)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Workspace '${id}' not found`
          });

        if (storage) {
          await Promise.all(
            projectIds.map(projectId => storage.deleteAll(id, projectId).catch(() => {}))
          );
        }

        return { success: true, message: `Workspace '${workspace.name}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete workspace');
      }
    })
  );

  return router;
}
