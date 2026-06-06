import { AR_COLOR_BLUE, AR_COLOR_GREEN, AR_COLOR_YELLOW } from '@arch-register/api-types/colors';
import { randomUUID } from 'node:crypto';
import { H3, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import type { Workspace } from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { handleDbError, slugify } from '../utils/http.js';
import type { StorageAdapter } from '../storage/storage.js';
import { buildApiAuthCtx, requireGlobalPermission } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { httpAssert } from '../utils/httpAssert.js';
import { toApiWorkspace } from '../api/transforms.js';
import { SCHEMA_TEMPLATES, instantiateTemplate } from '../schemaTemplates.js';

const BASE = '/api/workspaces';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, { unique: 'A workspace with that name already exists' });

export const shortCode = (name: string): string =>
  name
    .split(/\s+/)
    .map(w => (w[0] ?? '').toUpperCase())
    .join('')
    .slice(0, 2);

export const buildDefaultLifecycleStates = (workspace: string, createdAt: Date) => [
  { id: 'proposed', workspace, label: 'Proposed', color: AR_COLOR_BLUE, sort_order: 0, created_at: createdAt },
  { id: 'experimental', workspace, label: 'Experimental', color: AR_COLOR_BLUE, sort_order: 1, created_at: createdAt },
  { id: 'production', workspace, label: 'Production', color: AR_COLOR_GREEN, sort_order: 2, created_at: createdAt },
  { id: 'deprecated', workspace, label: 'Deprecated', color: AR_COLOR_YELLOW, sort_order: 3, created_at: createdAt }
];

export const buildDefaultWorkspaceTeams = (workspace: string, createdAt: Date) => [
  { id: 'platform-team', workspace, sort_order: 0, color: null, description: '', created_at: createdAt },
  { id: 'ux-team', workspace, sort_order: 1, color: null, description: '', created_at: createdAt },
  { id: 'security-team', workspace, sort_order: 2, color: null, description: '', created_at: createdAt }
];

export const buildWorkspaceCreateInput = (
  body: Record<string, unknown>,
  createdAt: Date
) => {
  const {
    name,
    description = '',
    color = '',
    slug: slugOverride,
    badge
  } = body;
  httpAssert.string(name, { message: 'name is required and must be a string' });
  const rawSlug = typeof slugOverride === 'string' && slugOverride ? slugOverride : name;
  const id = slugify(rawSlug);
  httpAssert.string(id, { message: 'name must contain at least one alphanumeric character' });

  return {
    id,
    name,
    url_slug: id,
    short_code:
      typeof badge === 'string' && badge ? badge.slice(0, 2).toUpperCase() : shortCode(name),
    color: typeof color === 'string' ? color : '',
    description: typeof description === 'string' ? description : '',
    created_at: createdAt,
    updated_at: createdAt
  };
};

export const buildWorkspaceUpdateInput = (
  body: Record<string, unknown>,
  current: Workspace,
  updatedAt: Date
) => {
  const { name, description, url_slug, short_code: sc, color } = body;
  httpAssert.string(name, { status: 400, message: 'name is required and must be a string' });
  if (url_slug != null && typeof url_slug === 'string') {
    const cleaned = slugify(url_slug);
    httpAssert.string(cleaned, {
      message: 'url_slug must contain at least one alphanumeric character'
    });
  }

  return {
    name,
    url_slug: typeof url_slug === 'string' ? slugify(url_slug) : current.url_slug,
    short_code: typeof sc === 'string' ? sc : current.short_code,
    color: typeof color === 'string' ? color : current.color,
    description: typeof description === 'string' ? description : current.description,
    updated_at: updatedAt
  };
};

export const normalizeReplicationInclude = (include: unknown) =>
  new Set<string>(
    Array.isArray(include)
      ? (include as unknown[]).filter((x): x is string => typeof x === 'string')
      : ['schemas', 'settings']
  );

export function createWorkspaceRoutes(db: DatabaseAdapter, storage?: StorageAdapter) {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async () => {
      try {
        const workspaces = await db.workspaceAdmin.listWorkspaces();
        return workspaces.map(toApiWorkspace);
      } catch (e) {
        handleError(e, 'Failed to retrieve workspaces');
      }
    })
  );

  router.get(
    `${BASE}/templates`,
    defineHandler(async () => {
      return SCHEMA_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'admin_platform');
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      const { template, replicate_from, include } = body as Record<string, unknown>;
      try {
        const timestamp = new Date();
        const row = await db.workspaceAdmin.createWorkspace(
          buildWorkspaceCreateInput(body as Record<string, unknown>, timestamp)
        );

        if (typeof replicate_from === 'string' && replicate_from) {
          const includeSet = normalizeReplicationInclude(include);

          const [srcLifecycle, srcTeams, srcRoles, srcSchemas] = await Promise.all([
            db.workspaceAdmin.listLifecycleStates(replicate_from),
            db.workspaceAdmin.listTeams(replicate_from),
            db.workspaceAdmin.listCustomWorkspaceRoles(replicate_from),
            db.catalog.listSchemas(replicate_from),
          ]);

          if (includeSet.has('settings')) {
            const lifecycleStates = srcLifecycle.length > 0
              ? srcLifecycle.map(s => ({ ...s, workspace: row.id, created_at: timestamp }))
              : buildDefaultLifecycleStates(row.id, timestamp);
            await db.workspaceAdmin.replaceLifecycleStates(row.id, lifecycleStates);
            await db.workspaceAdmin.replaceTeams(
              row.id,
              srcTeams.map(t => ({ ...t, workspace: row.id, created_at: timestamp }))
            );
            for (const role of srcRoles) {
              await db.workspaceAdmin.createCustomWorkspaceRole({
                ...role,
                id: randomUUID(),
                workspace: row.id,
                created_at: timestamp,
                updated_at: timestamp,
              });
            }
          } else {
            await db.workspaceAdmin.replaceLifecycleStates(row.id, buildDefaultLifecycleStates(row.id, timestamp));
            await db.workspaceAdmin.replaceTeams(row.id, buildDefaultWorkspaceTeams(row.id, timestamp));
          }

          if (includeSet.has('schemas')) {
            const idMap = new Map<string, string>(srcSchemas.map(s => [s.id, randomUUID()]));
            for (const schema of srcSchemas) {
              const remappedFields = schema.fields.map(field => {
                if (field.type === 'reference' || field.type === 'containment') {
                  return { ...field, schemaId: idMap.get(field.schemaId) ?? field.schemaId };
                }
                return field;
              });
              await db.catalog.createSchema({
                id: idMap.get(schema.id)!,
                workspace: row.id,
                name: schema.name,
                description: schema.description,
                color: schema.color,
                icon: schema.icon,
                fields: remappedFields,
                default_owner: null,
                created_at: timestamp,
                updated_at: timestamp,
              });
            }
          }
        } else {
          await db.workspaceAdmin.replaceLifecycleStates(row.id, buildDefaultLifecycleStates(row.id, timestamp));

          await db.workspaceAdmin.replaceTeams(row.id, buildDefaultWorkspaceTeams(row.id, timestamp));

          if (typeof template === 'string' && template && template !== 'blank') {
            const schemas = instantiateTemplate(row.id, template);
            for (const schema of schemas) {
              await db.catalog.createSchema(schema);
            }
          }
        }

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

        return toApiWorkspace(row);
      } catch (e) {
        handleError(e, 'Failed to create workspace');
      }
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'admin_platform');
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      try {
        const oldRow = await db.workspaceAdmin.getWorkspace(id);
        httpAssert.present(oldRow, { status: 404, message: `Workspace '${id}' not found` });

        const row = await db.workspaceAdmin.updateWorkspace(
          id,
          buildWorkspaceUpdateInput(body as Record<string, unknown>, oldRow, new Date())
        );
        httpAssert.present(row, { status: 404, message: `Workspace '${id}' not found` });
        const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));

        await logAudit(db, {
          workspace: id,
          operation: 'update',
          entityType: 'workspace',
          entityId: id,
          entityName: row.name,
          changes
        });

        return toApiWorkspace(row);
      } catch (e) {
        handleError(e, 'Failed to update workspace');
      }
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, '__global__', event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'admin_platform');
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
