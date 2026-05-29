import { H3, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import type { Workspace } from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { handleDbError, slugify } from '../utils/http.js';
import type { StorageAdapter } from '../storage/storage.js';
import { buildApiAuthCtx, requireGlobalPermission } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { httpAssert } from '../utils/httpAssert.js';

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

  router.get(
    BASE,
    defineHandler(async () => {
      try {
        return (await db.workspaceAdmin.listWorkspaces()) as Workspace[];
      } catch (e) {
        handleError(e, 'Failed to retrieve workspaces');
      }
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'admin_platform');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const { name, description = '' } = body as Record<string, unknown>;
      httpAssert.string(name, { message: 'name is required and must be a string' });
      const id = slugify(name);
      httpAssert.string(id, { message: 'name must contain at least one alphanumeric character' });
      const urlSlug = id;
      const sc = shortCode(name as string);
      try {
        const timestamp = new Date();
        const row = await db.workspaceAdmin.createWorkspace({
          id,
          name: name as string,
          url_slug: urlSlug,
          short_code: sc,
          description: typeof description === 'string' ? description : '',
          created_at: timestamp,
          updated_at: timestamp
        });

        await db.workspaceAdmin.replaceLifecycleStates(id, [
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

        await db.workspaceAdmin.replaceOwners(id, [
          { id: 'platform-team', workspace: id, sort_order: 0, created_at: timestamp },
          { id: 'ux-team', workspace: id, sort_order: 1, created_at: timestamp },
          { id: 'security-team', workspace: id, sort_order: 2, created_at: timestamp }
        ]);

        await logAudit(db, {
          workspace: row.id,
          operation: 'create',
          entityType: 'workspace',
          entityId: row.id,
          entityName: row.name,
          changes: {
            new: extractEntityFields(row)
          }
        });

        return row;
      } catch (e) {
        handleError(e, 'Failed to create workspace');
      }
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'admin_platform');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const { name, description, url_slug, short_code: sc } = body as Record<string, unknown>;
      httpAssert.string(name, { status: 400, message: 'name is required and must be a string' });
      if (url_slug != null && typeof url_slug === 'string') {
        const cleaned = slugify(url_slug);
        httpAssert.string(cleaned, {
          message: 'url_slug must contain at least one alphanumeric character'
        });
      }
      try {
        const oldRow = await db.workspaceAdmin.getWorkspace(id);
        httpAssert.present(oldRow, { status: 404, message: `Workspace '${id}' not found` });

        const row = await db.workspaceAdmin.updateWorkspace(id, {
          name: name as string,
          url_slug: typeof url_slug === 'string' ? slugify(url_slug) : oldRow.url_slug,
          short_code: typeof sc === 'string' ? sc : oldRow.short_code,
          description: typeof description === 'string' ? description : oldRow.description,
          updated_at: new Date()
        });

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

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      if (authCtx) requireGlobalPermission(authCtx, 'admin_platform');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });

      try {
        const { workspace, projectIds } = await db.workspaceAdmin.deleteWorkspace(id);
        httpAssert.present(workspace, { status: 404, message: `Workspace '${id}' not found` });

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