import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { buildApiAuthCtx, requireWorkspaceAdmin } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import { createJobSchedule, enqueueJobRun, setJobScheduleEnabled } from '../jobs/jobOperations';
import type {
  ExternalContentMountDbResult,
  ExternalContentSourceDbResult,
  GitSourceConfig
} from './db/externalContentDatabase';

const JOB_TYPE = 'external-content.refresh';
const SYSTEM_IDENTITY = 'external-content';

const normalizeUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Git source URL must be a valid URL');
  }
  if (url.protocol !== 'https:') throw new Error('Only Git HTTPS URLs are supported');
  if (url.username || url.password) throw new Error('Git source URLs must not contain credentials');
  if (url.search || url.hash) throw new Error('Git source URLs must not contain query or hash components');
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
};

const normalizePath = (value: string, name: string, allowEmpty: boolean) => {
  const normalized = value.trim().replace(/^\/+|\/+$/g, '');
  if (!allowEmpty && normalized.length === 0) throw new Error(`${name} must not be empty`);
  if (normalized.split('/').some(part => part === '' || part === '.' || part === '..')) {
    throw new Error(`${name} contains an invalid path segment`);
  }
  return normalized;
};

const identityKey = (config: GitSourceConfig) =>
  createHash('sha256').update(JSON.stringify({ type: config.type, url: config.url })).digest('hex');

const scopeFields = (scope: { type: 'workspace' | 'project' | 'entity'; id?: string }) => ({
  project_id: scope.type === 'project' ? scope.id! : null,
  entity_id: scope.type === 'entity' ? scope.id! : null
});

const toApiSource = (source: ExternalContentSourceDbResult) => ({
  id: source.id,
  workspace: source.workspace,
  source_type: source.source_type,
  source_config: source.source_config,
  enabled: source.enabled,
  status: source.status,
  last_attempt_at: source.last_attempt_at?.toISOString() ?? null,
  last_synced_at: source.last_synced_at?.toISOString() ?? null,
  last_revision: source.last_revision,
  last_error: source.last_error,
  created_at: source.created_at.toISOString(),
  updated_at: source.updated_at.toISOString()
});

const toApiMount = async (db: DatabaseAdapter, mount: ExternalContentMountDbResult) => {
  const source = await db.externalContent.getSource(mount.workspace, mount.source_id);
  httpAssert.present(source, { status: 500, message: 'External content source not found' });
  return {
    id: mount.id,
    workspace: mount.workspace,
    source_id: mount.source_id,
    scope: mount.project_id
      ? { type: 'project' as const, id: mount.project_id }
      : mount.entity_id
        ? { type: 'entity' as const, id: mount.entity_id }
        : { type: 'workspace' as const },
    destination_path: mount.destination_path,
    source_path: mount.source_path,
    status: mount.status,
    last_synced_at: mount.last_synced_at?.toISOString() ?? null,
    last_revision: mount.last_revision,
    last_error: mount.last_error,
    created_at: mount.created_at.toISOString(),
    updated_at: mount.updated_at.toISOString(),
    source: toApiSource(source)
  };
};

const validateScope = async (db: DatabaseAdapter, workspace: string, scope: { type: 'workspace' | 'project' | 'entity'; id?: string }) => {
  if (scope.type === 'project') {
    const project = await db.project.getProject(workspace, scope.id!);
    httpAssert.present(project, { status: 404, message: `Project '${scope.id}' not found` });
    return { type: 'project' as const, id: project.id };
  }
  if (scope.type === 'entity') {
    const entity = await db.catalog.getEntity(workspace, scope.id!);
    httpAssert.present(entity, { status: 404, message: `Entity '${scope.id}' not found` });
    return { type: 'entity' as const, id: entity.id };
  }
  return { type: 'workspace' as const };
};

const scopeNodes = async (db: DatabaseAdapter, workspace: string, scope: { type: 'workspace' | 'project' | 'entity'; id?: string }) => {
  if (scope.type === 'project') {
    const project = await db.project.getProject(workspace, scope.id!);
    httpAssert.present(project, { status: 404, message: `Project '${scope.id}' not found` });
    return db.project.listContentNodes(workspace, project.id);
  }
  if (scope.type === 'entity') {
    const entity = await db.catalog.getEntity(workspace, scope.id!);
    httpAssert.present(entity, { status: 404, message: `Entity '${scope.id}' not found` });
    return db.project.listEntityContentNodes(workspace, entity.id);
  }
  return db.project.listWorkspaceContentNodes(workspace);
};

export const listExternalContentMounts = async (db: DatabaseAdapter, workspace: string, event: AuthenticatedEvent) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  const mounts = await db.externalContent.listMounts(ws);
  return Promise.all(mounts.map(mount => toApiMount(db, mount)));
};

export const createExternalContentMount = async (
  db: DatabaseAdapter,
  workspace: string,
  input: {
    source: GitSourceConfig;
    scope: { type: 'workspace' | 'project' | 'entity'; id?: string };
    destination_path: string;
    source_path: string;
    interval_hours: number;
  },
  event: AuthenticatedEvent
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  const normalizedScope = await validateScope(db, ws, input.scope);
  const destinationPath = normalizePath(input.destination_path, 'destination_path', false);
  const sourcePath = normalizePath(input.source_path, 'source_path', true);
  const config: GitSourceConfig = { type: 'git', url: normalizeUrl(input.source.url) };
  const existingNodes = await scopeNodes(db, ws, normalizedScope);
  const conflictingNode = existingNodes.find(
    node => node.path === destinationPath || node.path.startsWith(`${destinationPath}/`)
  );
  httpAssert.true(!conflictingNode, {
    status: 409,
    message: `Destination path '${destinationPath}' is already in use`
  });

  const now = new Date();
  const sourceKey = identityKey(config);
  const scopeInput = scopeFields(normalizedScope);
  const result = await db.core.transaction(async tx => {
    let source = await tx.externalContent.getSourceByIdentity(ws, 'git', sourceKey);
    if (!source) {
      source = await tx.externalContent.createSource({
        id: randomUUID(),
        workspace: ws,
        source_type: 'git',
        source_config: config,
        identity_key: sourceKey,
        schedule_id: null,
        enabled: true,
        status: 'pending',
        created_at: now,
        updated_at: now
      });
      const schedule = await createJobSchedule(tx, {
        workspace: ws,
        jobType: JOB_TYPE,
        systemIdentity: SYSTEM_IDENTITY,
        payload: { sourceId: source.id },
        priority: 5,
        recurrence: { type: 'hours', intervalHours: input.interval_hours, startsAt: now }
      }, now);
      source = (await tx.externalContent.updateSource(source.id, {
        schedule_id: schedule.id,
        updated_at: now
      }))!;
    } else if (source.schedule_id) {
      await setJobScheduleEnabled(tx, source.schedule_id, true, now);
      source = (await tx.externalContent.updateSource(source.id, { enabled: true, updated_at: now }))!;
    } else {
      const schedule = await createJobSchedule(tx, {
        workspace: ws,
        jobType: JOB_TYPE,
        systemIdentity: SYSTEM_IDENTITY,
        payload: { sourceId: source.id },
        priority: 5,
        recurrence: { type: 'hours', intervalHours: input.interval_hours, startsAt: now }
      }, now);
      source = (await tx.externalContent.updateSource(source.id, {
        schedule_id: schedule.id,
        enabled: true,
        updated_at: now
      }))!;
    }

    const mount = await tx.externalContent.createMount({
      id: randomUUID(),
      workspace: ws,
      source_id: source.id,
      ...scopeInput,
      destination_path: destinationPath,
      source_path: sourcePath,
      status: 'pending',
      last_synced_at: null,
      last_revision: null,
      last_error: null,
      created_at: now,
      updated_at: now
    });
    if (source.schedule_id) await enqueueJobRun(tx, source.schedule_id, now);
    return mount;
  });
  return toApiMount(db, result);
};

export const removeExternalContentMount = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  mountId: string,
  event: AuthenticatedEvent
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  const mount = await db.externalContent.getMount(ws, mountId);
  httpAssert.present(mount, { status: 404, message: 'Content mount not found' });
  const source = await db.externalContent.getSource(ws, mount.source_id);
  const nodes = await db.project.listContentNodesByMount(ws, mount.id);
  for (const node of nodes) {
    if (node.type !== 'folder') {
      await storage.delete(ws, node.project_id ?? node.entity_id ?? ws, node.id).catch(() => undefined);
    }
  }
  await db.core.transaction(async tx => {
    await tx.project.deleteContentNodesByIds(ws, nodes.map(node => node.id));
    await tx.externalContent.deleteMount(ws, mount.id);
    if (source) {
      const remaining = await tx.externalContent.listMountsBySource(ws, source.id);
      if (remaining.length === 0) {
        if (source.schedule_id) await setJobScheduleEnabled(tx, source.schedule_id, false);
        await tx.externalContent.updateSource(source.id, { enabled: false, updated_at: new Date() });
      }
    }
  });
  return { success: true };
};

export const syncExternalContentMount = async (
  db: DatabaseAdapter,
  workspace: string,
  mountId: string,
  event: AuthenticatedEvent
) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  const mount = await db.externalContent.getMount(ws, mountId);
  httpAssert.present(mount, { status: 404, message: 'Content mount not found' });
  const source = await db.externalContent.getSource(ws, mount.source_id);
  httpAssert.present(source, { status: 404, message: 'External content source not found' });
  const run = source.schedule_id ? await enqueueJobRun(db, source.schedule_id) : null;
  return { success: !!run, run_id: run?.id ?? null };
};
