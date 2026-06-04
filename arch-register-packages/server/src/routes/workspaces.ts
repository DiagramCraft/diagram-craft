import { AR_COLOR_BLUE, AR_COLOR_GREEN, AR_COLOR_YELLOW } from '@arch-register/api-types/colors';
import { newid } from '@diagram-craft/utils/id';
import { H3, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
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
      const { name, description = '', color = '', slug: slugOverride, badge, template, replicate_from, include } = body as Record<string, unknown>;
      httpAssert.string(name, { message: 'name is required and must be a string' });
      const rawSlug = typeof slugOverride === 'string' && slugOverride ? slugOverride : (name as string);
      const id = slugify(rawSlug);
      httpAssert.string(id, { message: 'name must contain at least one alphanumeric character' });
      const urlSlug = id;
      const sc = typeof badge === 'string' && badge ? badge.slice(0, 2).toUpperCase() : shortCode(name as string);
      const colorVal = typeof color === 'string' ? color : '';
      try {
        const timestamp = new Date();
        const row = await db.workspaceAdmin.createWorkspace({
          id,
          name: name as string,
          url_slug: urlSlug,
          short_code: sc,
          color: colorVal,
          description: typeof description === 'string' ? description : '',
          created_at: timestamp,
          updated_at: timestamp
        });

        if (typeof replicate_from === 'string' && replicate_from) {
          const includeSet = new Set<string>(
            Array.isArray(include) ? (include as unknown[]).filter((x): x is string => typeof x === 'string') : ['schemas', 'settings']
          );

          const [srcLifecycle, srcTeams, srcRoles, srcSchemas] = await Promise.all([
            db.workspaceAdmin.listLifecycleStates(replicate_from),
            db.workspaceAdmin.listTeams(replicate_from),
            db.workspaceAdmin.listCustomWorkspaceRoles(replicate_from),
            db.catalog.listSchemas(replicate_from),
          ]);

          if (includeSet.has('settings')) {
            const lifecycleStates = srcLifecycle.length > 0
              ? srcLifecycle.map(s => ({ ...s, workspace: id, created_at: timestamp }))
              : [
                  { id: 'proposed', workspace: id, label: 'Proposed', color: AR_COLOR_BLUE, sort_order: 0, created_at: timestamp },
                  { id: 'experimental', workspace: id, label: 'Experimental', color: AR_COLOR_BLUE, sort_order: 1, created_at: timestamp },
                  { id: 'production', workspace: id, label: 'Production', color: AR_COLOR_GREEN, sort_order: 2, created_at: timestamp },
                  { id: 'deprecated', workspace: id, label: 'Deprecated', color: AR_COLOR_YELLOW, sort_order: 3, created_at: timestamp },
                ];
            await db.workspaceAdmin.replaceLifecycleStates(id, lifecycleStates);
            await db.workspaceAdmin.replaceTeams(
              id,
              srcTeams.map(t => ({ ...t, workspace: id, created_at: timestamp }))
            );
            for (const role of srcRoles) {
              await db.workspaceAdmin.createCustomWorkspaceRole({
                ...role,
                id: newid(),
                workspace: id,
                created_at: timestamp,
                updated_at: timestamp,
              });
            }
          } else {
            await db.workspaceAdmin.replaceLifecycleStates(id, [
              { id: 'proposed', workspace: id, label: 'Proposed', color: AR_COLOR_BLUE, sort_order: 0, created_at: timestamp },
              { id: 'experimental', workspace: id, label: 'Experimental', color: AR_COLOR_BLUE, sort_order: 1, created_at: timestamp },
              { id: 'production', workspace: id, label: 'Production', color: AR_COLOR_GREEN, sort_order: 2, created_at: timestamp },
              { id: 'deprecated', workspace: id, label: 'Deprecated', color: AR_COLOR_YELLOW, sort_order: 3, created_at: timestamp },
            ]);
            await db.workspaceAdmin.replaceTeams(id, [
              { id: 'platform-team', workspace: id, sort_order: 0, color: null, description: '', created_at: timestamp },
              { id: 'ux-team', workspace: id, sort_order: 1, color: null, description: '', created_at: timestamp },
              { id: 'security-team', workspace: id, sort_order: 2, color: null, description: '', created_at: timestamp },
            ]);
          }

          if (includeSet.has('schemas')) {
            const idMap = new Map<string, string>(srcSchemas.map(s => [s.id, newid()]));
            for (const schema of srcSchemas) {
              const remappedFields = schema.fields.map(field => {
                if (field.type === 'reference' || field.type === 'containment') {
                  return { ...field, schemaId: idMap.get(field.schemaId) ?? field.schemaId };
                }
                return field;
              });
              await db.catalog.createSchema({
                id: idMap.get(schema.id)!,
                workspace: id,
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
          await db.workspaceAdmin.replaceLifecycleStates(id, [
            { id: 'proposed', workspace: id, label: 'Proposed', color: AR_COLOR_BLUE, sort_order: 0, created_at: timestamp },
            { id: 'experimental', workspace: id, label: 'Experimental', color: AR_COLOR_BLUE, sort_order: 1, created_at: timestamp },
            { id: 'production', workspace: id, label: 'Production', color: AR_COLOR_GREEN, sort_order: 2, created_at: timestamp },
            { id: 'deprecated', workspace: id, label: 'Deprecated', color: AR_COLOR_YELLOW, sort_order: 3, created_at: timestamp },
          ]);

          await db.workspaceAdmin.replaceTeams(id, [
            { id: 'platform-team', workspace: id, sort_order: 0, color: null, description: '', created_at: timestamp },
            { id: 'ux-team', workspace: id, sort_order: 1, color: null, description: '', created_at: timestamp },
            { id: 'security-team', workspace: id, sort_order: 2, color: null, description: '', created_at: timestamp },
          ]);

          if (typeof template === 'string' && template && template !== 'blank') {
            const schemas = instantiateTemplate(id, template);
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
      const { name, description, url_slug, short_code: sc, color } = body as Record<string, unknown>;
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
          color: typeof color === 'string' ? color : oldRow.color,
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

        

                return toApiWorkspace(row!);
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
