import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireGlobalPermission } from '../auth/authorization';
import { defineGlobalOperation } from '../operation';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { HTTPError } from 'h3';
import { handleDbError, slugify } from '../../utils/http';
import { AR_COLOR_BLUE, AR_COLOR_GREEN, AR_COLOR_YELLOW } from '@arch-register/api-types/colors';
import { toApiWorkspace } from './workspaceHelpers';
import { instantiateTemplate } from '../catalog/schemaTemplates';
import type { WorkspaceDbResult } from './db/workspaceDatabase';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import { validatePublicIdPrefix } from '../../utils/publicIds';

const shortCodeFrom = (name: string): string =>
  name
    .split(/\s+/)
    .map(w => (w[0] ?? '').toUpperCase())
    .join('')
    .slice(0, 5);

const buildCreateInput = (
  input: {
    name: string;
    description?: string;
    color?: string;
    slug?: string;
    badge?: string;
  },
  createdAt: Date
) => {
  const urlSlug = slugify(input.slug ?? input.name);
  if (!urlSlug) {
    throw Object.assign(new Error('name must contain at least one alphanumeric character'), {
      status: 400
    });
  }
  return {
    id: randomUUID(),
    name: input.name,
    url_slug: urlSlug,
    short_code: validatePublicIdPrefix(input.badge ?? shortCodeFrom(input.name), 'short_code')!,
    color: input.color ?? '',
    description: input.description ?? '',
    created_at: createdAt,
    updated_at: createdAt
  };
};

const buildUpdateInput = (
  input: {
    name: string;
    description?: string;
    url_slug?: string;
    short_code?: string;
    color?: string;
  },
  current: WorkspaceDbResult,
  updatedAt: Date
) => ({
  name: input.name,
  url_slug:
    input.url_slug != null ? (slugify(input.url_slug) ?? current.url_slug) : current.url_slug,
  short_code:
    input.short_code !== undefined
      ? validatePublicIdPrefix(input.short_code, 'short_code')!
      : current.short_code,
  color: input.color ?? current.color,
  description: input.description ?? current.description,
  updated_at: updatedAt
});

const buildDefaultLifecycleStates = (workspace: string, createdAt: Date) => [
  {
    id: randomUUID(),
    workspace,
    label: 'Proposed',
    color: AR_COLOR_BLUE,
    sort_order: 0,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Experimental',
    color: AR_COLOR_BLUE,
    sort_order: 1,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Production',
    color: AR_COLOR_GREEN,
    sort_order: 2,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Deprecated',
    color: AR_COLOR_YELLOW,
    sort_order: 3,
    created_at: createdAt
  }
];

const buildDefaultProjectEntityTypes = (workspace: string, createdAt: Date) => [
  { id: randomUUID(), workspace, label: 'Introduced', sort_order: 0, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Decommissioned', sort_order: 1, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Modified', sort_order: 2, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Used', sort_order: 3, created_at: createdAt }
];

const buildDefaultWorkspaceTeams = (workspace: string, createdAt: Date) => [
  {
    id: randomUUID(),
    workspace,
    name: 'Platform Team',
    sort_order: 0,
    color: null,
    description: '',
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    name: 'UX Team',
    sort_order: 1,
    color: null,
    description: '',
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    name: 'Security Team',
    sort_order: 2,
    color: null,
    description: '',
    created_at: createdAt
  }
];

const normalizeInclude = (include: string[] | undefined): Set<string> =>
  new Set<string>(include ?? ['schemas', 'settings']);

export const listWorkspaces = async (
  db: DatabaseAdapter,
  event?: AuthenticatedEvent
): Promise<Workspace[]> => {
  try {
    const workspaces = event?.context.apiToken
      ? await db.workspace.getWorkspace(event.context.apiToken.workspace).then(workspace =>
          workspace ? [workspace] : []
        )
      : await db.workspace.listWorkspaces();
    return workspaces.map(toApiWorkspace);
  } catch (e) {
    return handleDbError(e, 'Failed to retrieve workspaces', {
      unique: 'A workspace with that name already exists'
    });
  }
};

export const createWorkspace = async (
  db: DatabaseAdapter,
  input: {
    name: string;
    description?: string;
    color?: string;
    slug?: string;
    badge?: string;
    template?: string;
    replicate_from?: string;
    include?: string[];
  },
  event: AuthenticatedEvent
): Promise<Workspace> => {
  return defineGlobalOperation(
    db,
    event,
    {
      fallback: 'Failed to create workspace',
      dbErrorMessages: { unique: 'A workspace with that name already exists' }
    },
    async ({ authCtx }) => {
      requireGlobalPermission(authCtx, 'admin_platform');
      const timestamp = new Date();
      const row = await db.workspace.createWorkspace(buildCreateInput(input, timestamp));
      await db.workspace.registerPublicIdPrefix(row.short_code, 'workspace', row.id, timestamp);

      const { template, replicate_from, include } = input;

      if (typeof replicate_from === 'string' && replicate_from) {
        const includeSet = normalizeInclude(include);

        const [srcLifecycle, srcTeams, srcRoles, srcSchemas] = await Promise.all([
          db.workspace.listLifecycleStates(replicate_from),
          db.workspace.listTeams(replicate_from),
          db.workspace.listCustomWorkspaceRoles(replicate_from),
          db.catalog.listSchemas(replicate_from)
        ]);

        if (includeSet.has('settings')) {
          const lifecycleStates =
            srcLifecycle.length > 0
              ? srcLifecycle.map(s => ({ ...s, workspace: row.id, created_at: timestamp }))
              : buildDefaultLifecycleStates(row.id, timestamp);
          await db.workspace.replaceLifecycleStates(row.id, lifecycleStates);
          await db.workspace.replaceProjectEntityTypes(
            row.id,
            buildDefaultProjectEntityTypes(row.id, timestamp)
          );
          await db.workspace.replaceTeams(
            row.id,
            srcTeams.map(t => ({ ...t, workspace: row.id, created_at: timestamp }))
          );
          for (const role of srcRoles) {
            await db.workspace.createCustomWorkspaceRole({
              ...role,
              id: randomUUID(),
              workspace: row.id,
              created_at: timestamp,
              updated_at: timestamp
            });
          }
        } else {
          await db.workspace.replaceLifecycleStates(
            row.id,
            buildDefaultLifecycleStates(row.id, timestamp)
          );
          await db.workspace.replaceProjectEntityTypes(
            row.id,
            buildDefaultProjectEntityTypes(row.id, timestamp)
          );
          await db.workspace.replaceTeams(row.id, buildDefaultWorkspaceTeams(row.id, timestamp));
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
              key_prefix: schema.key_prefix,
              color: schema.color,
              icon: schema.icon,
              fields: remappedFields,
              default_owner: null,
              created_at: timestamp,
              updated_at: timestamp
            });
            if (schema.key_prefix) {
              await db.workspace.registerPublicIdPrefix(
                schema.key_prefix,
                'schema',
                idMap.get(schema.id)!,
                timestamp
              );
            }
          }
        }
      } else {
        await db.workspace.replaceLifecycleStates(
          row.id,
          buildDefaultLifecycleStates(row.id, timestamp)
        );
        await db.workspace.replaceProjectEntityTypes(
          row.id,
          buildDefaultProjectEntityTypes(row.id, timestamp)
        );
        await db.workspace.replaceTeams(row.id, buildDefaultWorkspaceTeams(row.id, timestamp));

        if (typeof template === 'string' && template && template !== 'blank') {
          const schemas = instantiateTemplate(row.id, template);
          for (const schema of schemas) {
            await db.catalog.createSchema(schema);
            if (schema.key_prefix) {
              await db.workspace.registerPublicIdPrefix(
                schema.key_prefix,
                'schema',
                schema.id,
                timestamp
              );
            }
          }
        }
      }

      await db.ai.upsertAiConfig(row.id, { enabled: false });

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: row.id,
        operation: 'create',
        entityType: 'workspace',
        entityId: row.id,
        entityName: row.name,
        changes: { new: extractEntityFields(row) }
      });

      return toApiWorkspace(row);
    }
  );
};

export const updateWorkspace = async (
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    description?: string;
    url_slug?: string;
    short_code?: string;
    color?: string;
  },
  event: AuthenticatedEvent
): Promise<Workspace> => {
  return defineGlobalOperation(
    db,
    event,
    {
      fallback: 'Failed to update workspace',
      dbErrorMessages: { unique: 'A workspace with that name already exists' }
    },
    async ({ authCtx }) => {
      requireGlobalPermission(authCtx, 'admin_platform');
      const oldRow = await db.workspace.getWorkspace(id);
      if (oldRow == null)
        throw new HTTPError({
          status: 404,
          statusText: 'Not Found',
          message: `Workspace '${id}' not found`
        });

      const updatedAt = new Date();
      const updateInput = buildUpdateInput(input, oldRow, updatedAt);
      const row = await db.workspace.updateWorkspace(id, updateInput);
      if (row == null)
        throw new HTTPError({
          status: 404,
          statusText: 'Not Found',
          message: `Workspace '${id}' not found`
        });

      if (oldRow.short_code !== row.short_code) {
        await db.workspace.updatePublicIdPrefix(
          oldRow.short_code,
          row.short_code,
          'workspace',
          row.id,
          updatedAt
        );
      }

      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: id,
        operation: 'update',
        entityType: 'workspace',
        entityId: id,
        entityName: row.name,
        changes
      });

      return toApiWorkspace(row);
    }
  );
};

export const deleteWorkspace = async (
  db: DatabaseAdapter,
  id: string,
  event: AuthenticatedEvent,
  storage?: StorageAdapter
): Promise<{ success: boolean; message: string }> => {
  return defineGlobalOperation(
    db,
    event,
    {
      fallback: 'Failed to delete workspace',
      dbErrorMessages: { unique: 'A workspace with that name already exists' }
    },
    async ({ authCtx }) => {
      requireGlobalPermission(authCtx, 'admin_platform');
      const { workspace, projectIds } = await db.workspace.deleteWorkspace(id);
      if (workspace == null)
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
    }
  );
};
