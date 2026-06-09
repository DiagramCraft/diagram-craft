import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireGlobalPermission } from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { handleDbError, slugify } from '../../utils/http';
import { AR_COLOR_BLUE, AR_COLOR_GREEN, AR_COLOR_YELLOW } from '@arch-register/api-types/colors';
import type { Workspace } from '@arch-register/api-types';
import { toApiWorkspace } from './workspaceHelpers';
import { SCHEMA_TEMPLATES, instantiateTemplate } from '../catalog/schemaTemplates';
import type { WorkspaceDbResult } from './db/workspaceDatabase';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, { unique: 'A workspace with that name already exists' });

const shortCodeFrom = (name: string): string =>
  name
    .split(/\s+/)
    .map(w => (w[0] ?? '').toUpperCase())
    .join('')
    .slice(0, 2);

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
    short_code: input.badge ? input.badge.slice(0, 2).toUpperCase() : shortCodeFrom(input.name),
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
  url_slug: input.url_slug != null ? (slugify(input.url_slug) ?? current.url_slug) : current.url_slug,
  short_code: input.short_code ?? current.short_code,
  color: input.color ?? current.color,
  description: input.description ?? current.description,
  updated_at: updatedAt
});

const buildDefaultLifecycleStates = (workspace: string, createdAt: Date) => [
  { id: randomUUID(), workspace, label: 'Proposed', color: AR_COLOR_BLUE, sort_order: 0, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Experimental', color: AR_COLOR_BLUE, sort_order: 1, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Production', color: AR_COLOR_GREEN, sort_order: 2, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Deprecated', color: AR_COLOR_YELLOW, sort_order: 3, created_at: createdAt }
];

const buildDefaultWorkspaceTeams = (workspace: string, createdAt: Date) => [
  { id: randomUUID(), workspace, name: 'Platform Team', sort_order: 0, color: null, description: '', created_at: createdAt },
  { id: randomUUID(), workspace, name: 'UX Team', sort_order: 1, color: null, description: '', created_at: createdAt },
  { id: randomUUID(), workspace, name: 'Security Team', sort_order: 2, color: null, description: '', created_at: createdAt }
];

const normalizeInclude = (include: string[] | undefined): Set<string> =>
  new Set<string>(include ?? ['schemas', 'settings']);

export const listWorkspaces = async (db: DatabaseAdapter): Promise<Workspace[]> => {
  try {
    const workspaces = await db.workspace.listWorkspaces();
    return workspaces.map(toApiWorkspace);
  } catch (e) {
    handleError(e, 'Failed to retrieve workspaces');
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
  const authCtx = await buildApiAuthCtx(db, '__global__', event);
  requireGlobalPermission(authCtx, 'admin_platform');

  try {
    const timestamp = new Date();
    const row = await db.workspace.createWorkspace(buildCreateInput(input, timestamp));

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
        await db.workspace.replaceLifecycleStates(row.id, buildDefaultLifecycleStates(row.id, timestamp));
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
            color: schema.color,
            icon: schema.icon,
            fields: remappedFields,
            default_owner: null,
            created_at: timestamp,
            updated_at: timestamp
          });
        }
      }
    } else {
      await db.workspace.replaceLifecycleStates(row.id, buildDefaultLifecycleStates(row.id, timestamp));
      await db.workspace.replaceTeams(row.id, buildDefaultWorkspaceTeams(row.id, timestamp));

      if (typeof template === 'string' && template && template !== 'blank') {
        const schemas = instantiateTemplate(row.id, template);
        for (const schema of schemas) {
          await db.catalog.createSchema(schema);
        }
      }
    }

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
  } catch (e) {
    handleError(e, 'Failed to create workspace');
  }
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
  const authCtx = await buildApiAuthCtx(db, '__global__', event);
  requireGlobalPermission(authCtx, 'admin_platform');

  try {
    const oldRow = await db.workspace.getWorkspace(id);
    if (oldRow == null) throw Object.assign(new Error(`Workspace '${id}' not found`), { status: 404 });

    const row = await db.workspace.updateWorkspace(id, buildUpdateInput(input, oldRow, new Date()));
    if (row == null) throw Object.assign(new Error(`Workspace '${id}' not found`), { status: 404 });

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
  } catch (e) {
    handleError(e, 'Failed to update workspace');
  }
};

export const deleteWorkspace = async (
  db: DatabaseAdapter,
  id: string,
  event: AuthenticatedEvent,
  storage?: StorageAdapter
): Promise<{ success: boolean; message: string }> => {
  const authCtx = await buildApiAuthCtx(db, '__global__', event);
  requireGlobalPermission(authCtx, 'admin_platform');

  try {
    const { workspace, projectIds } = await db.workspace.deleteWorkspace(id);
    if (workspace == null) throw Object.assign(new Error(`Workspace '${id}' not found`), { status: 404 });

    if (storage) {
      await Promise.all(
        projectIds.map(projectId => storage.deleteAll(id, projectId).catch(() => {}))
      );
    }

    return { success: true, message: `Workspace '${workspace.name}' deleted` };
  } catch (e) {
    handleError(e, 'Failed to delete workspace');
  }
};
