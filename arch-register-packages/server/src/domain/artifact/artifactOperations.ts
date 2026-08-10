import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { AuthorizationContext } from '@arch-register/permissions';
import type {
  ArtifactDiagnosticCategory,
  ArtifactSourceKind,
  ArtifactStatus,
  ArtifactType
} from '@arch-register/api-types/artifactContract';
import {
  getEntityCapabilityDefinition,
  resolveEntityCapabilityFieldMappings
} from '@arch-register/api-types/integrationCatalog';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { requireEntityAction, requireWorkspaceCapability } from '../auth/authorization';
import { toApiEntity } from '../catalog/entityHelpers';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type {
  ArtifactDbResult,
  ArtifactDiagnosticDb,
  ArtifactRevisionDbResult,
  ArtifactRevisionSummaryDbResult
} from './db/artifactDatabase';

const MAX_ARTIFACT_BYTES = 2_000_000;
export const API_SPECIFICATION_URL_REFRESH_JOB_TYPE = 'artifact.api-specification.refresh';
export const API_SPECIFICATION_URL_REFRESH_SYSTEM_IDENTITY = 'artifact-api-specification';
const API_SPECIFICATION_URL_REFRESH_MAX_ATTEMPTS = 3;

export type ArtifactRevisionInput = {
  sourceRevision?: string | null;
  mediaType?: string | null;
  content: string;
};

const enqueueApiSpecificationUrlRefresh = async (
  db: DatabaseAdapter,
  workspace: string,
  artifactId: string,
  now: Date
) =>
  enqueueOneOffJobRun(
    db,
    {
      workspace,
      jobType: API_SPECIFICATION_URL_REFRESH_JOB_TYPE,
      systemIdentity: API_SPECIFICATION_URL_REFRESH_SYSTEM_IDENTITY,
      payload: { artifactId },
      priority: 5,
      maxAttempts: API_SPECIFICATION_URL_REFRESH_MAX_ATTEMPTS
    },
    now
  );

export const getEntityAndSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string
) => {
  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
  const schema = await db.catalog.getSchema(workspace, entity.schema_id);
  httpAssert.present(schema, { status: 404, message: 'Entity schema not found' });
  return { entity, schema };
};

export const requireEntityView = (authCtx: AuthorizationContext, entity: EntityDbResult) =>
  requireEntityAction(
    authCtx,
    entity,
    'view_entity',
    'You do not have permission to view this entity'
  );

const requireArtifactWrite = (authCtx: AuthorizationContext, entity: EntityDbResult) => {
  requireEntityAction(
    authCtx,
    entity,
    'edit_entity',
    'You do not have permission to edit this entity'
  );
  requireWorkspaceCapability(
    authCtx,
    'artifact.manage',
    'You do not have permission to manage entity artifacts'
  );
};

const assertEntityCapabilityForArtifact = (schema: SchemaDbResult, artifactType: ArtifactType) => {
  const capability = (schema.entity_capabilities ?? []).find(item => item.type === artifactType);
  httpAssert.present(capability, {
    status: 409,
    message: `Schema '${schema.name}' does not declare entity capability '${artifactType}'`
  });
  const definition = getEntityCapabilityDefinition(artifactType);
  httpAssert.present(definition, {
    status: 409,
    message: `Entity capability '${artifactType}' is not available`
  });
  const resolution = resolveEntityCapabilityFieldMappings(capability, definition, schema.fields);
  httpAssert.true(resolution.issues.length === 0, {
    status: 409,
    message: `Schema '${schema.name}' has invalid field mappings for entity capability '${artifactType}': ${resolution.issues.map(issue => issue.message).join(' ')}`
  });
  return resolution;
};

const assertSafeSourceLocation = (kind: ArtifactSourceKind, location: string | null) => {
  if (kind === 'document') {
    httpAssert.true(location == null || location.length === 0, {
      status: 400,
      message: 'Document artifacts cannot contain a remote location'
    });
    return;
  }

  httpAssert.true(typeof location === 'string' && location.length > 0, {
    status: 400,
    message: 'This artifact source kind requires a location'
  });

  let url: URL;
  try {
    url = new URL(location!);
  } catch {
    httpAssert.true(false, { status: 400, message: 'Source location must be an absolute URL' });
    return;
  }
  httpAssert.true(url.protocol === 'https:', {
    status: 400,
    message: 'Remote artifact sources must use HTTPS'
  });
  httpAssert.true(url.username === '' && url.password === '', {
    status: 400,
    message: 'Source locations must not contain credentials'
  });
  if (kind === 'url') {
    httpAssert.true(url.hash === '', {
      status: 400,
      message: 'URL sources must not contain a fragment'
    });
  }

  const hostname = url.hostname.toLowerCase();
  httpAssert.true(
    hostname !== 'localhost' &&
      !hostname.endsWith('.localhost') &&
      hostname !== 'metadata.google.internal' &&
      hostname !== '0.0.0.0',
    { status: 400, message: 'Source location uses a blocked local hostname' }
  );

  const addressType = isIP(url.hostname);
  if (addressType === 4) {
    const octets = url.hostname.split('.').map(Number);
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    const privateAddress =
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 127 ||
      (first === 169 && second === 254);
    httpAssert.true(!privateAddress, {
      status: 400,
      message: 'Source location resolves to a private or link-local address'
    });
  }
  if (addressType === 6) {
    const normalized = url.hostname.toLowerCase();
    httpAssert.true(
      !normalized.includes('::1') && !normalized.startsWith('[fc') && !normalized.startsWith('[fd'),
      {
        status: 400,
        message: 'Source location resolves to a private or loopback address'
      }
    );
  }
};

const initialStatus = (kind: ArtifactSourceKind): ArtifactStatus =>
  kind === 'link' ? 'link_only' : 'pending';

const toDiagnostic = (diagnostic: ArtifactDiagnosticDb | null) =>
  diagnostic
    ? {
        category: diagnostic.category,
        message: diagnostic.message,
        timestamp: diagnostic.timestamp.toISOString()
      }
    : null;

const toArtifact = (artifact: ArtifactDbResult) => ({
  id: artifact.id,
  workspace: artifact.workspace,
  entityId: artifact.entity_id,
  artifactType: artifact.artifact_type,
  kind: artifact.kind,
  location: artifact.location,
  mediaType: artifact.media_type,
  status: artifact.status,
  currentRevisionId: artifact.current_revision_id,
  lastAttemptAt: artifact.last_attempt_at?.toISOString() ?? null,
  lastSuccessAt: artifact.last_success_at?.toISOString() ?? null,
  diagnostic: toDiagnostic(artifact.diagnostic),
  createdAt: artifact.created_at.toISOString(),
  updatedAt: artifact.updated_at.toISOString()
});

export const toRevision = (revision: ArtifactRevisionDbResult) => ({
  id: revision.id,
  artifactId: revision.artifact_id,
  sourceRevision: revision.source_revision,
  checksum: revision.checksum,
  mediaType: revision.media_type,
  contentSize: Buffer.byteLength(revision.content, 'utf8'),
  createdAt: revision.created_at.toISOString()
});

export const toRevisionSummary = (revision: ArtifactRevisionSummaryDbResult) => ({
  id: revision.id,
  artifactId: revision.artifact_id,
  sourceRevision: revision.source_revision,
  checksum: revision.checksum,
  mediaType: revision.media_type,
  contentSize: revision.content_size,
  createdAt: revision.created_at.toISOString()
});

const aggregateStatus = (artifacts: ArtifactDbResult[]): ArtifactStatus => {
  if (artifacts.length === 0) return 'not_configured';
  const priority: ArtifactStatus[] = [
    'pending',
    'failed',
    'invalid',
    'unsupported',
    'stale',
    'current',
    'link_only'
  ];
  return (
    priority.find(status => artifacts.some(artifact => artifact.status === status)) ??
    'not_configured'
  );
};

export const listArtifacts = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  authCtx: AuthorizationContext
) => {
  const { entity, schema } = await getEntityAndSchema(db, workspace, entityId);
  requireEntityView(authCtx, entity);
  const artifacts = await db.artifact.listArtifacts(workspace, entity.id);
  return {
    entity: toApiEntity(entity, authCtx, schema),
    artifacts: artifacts.map(toArtifact),
    status: aggregateStatus(artifacts)
  };
};

export const createArtifact = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  body: {
    artifactType: ArtifactType;
    kind: ArtifactSourceKind;
    location?: string | null;
    mediaType?: string | null;
  },
  authCtx: AuthorizationContext
) => {
  const { entity, schema } = await getEntityAndSchema(db, workspace, entityId);
  requireArtifactWrite(authCtx, entity);
  assertEntityCapabilityForArtifact(schema, body.artifactType);
  const location = body.location ?? null;
  assertSafeSourceLocation(body.kind, location);
  const timestamp = new Date();
  const artifact = await db.core.transaction(async tx => {
    const created = await tx.artifact.createArtifact({
      id: randomUUID(),
      workspace,
      entity_id: entity.id,
      artifact_type: body.artifactType,
      kind: body.kind,
      location,
      media_type: body.mediaType ?? null,
      status: initialStatus(body.kind),
      created_at: timestamp,
      updated_at: timestamp
    });
    if (body.artifactType === 'api-specification' && body.kind === 'url') {
      await enqueueApiSpecificationUrlRefresh(tx, workspace, created.id, timestamp);
    }
    return created;
  });
  return toArtifact(artifact);
};

export const refreshArtifact = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  artifactId: string,
  authCtx: AuthorizationContext
) => {
  const { entity } = await getEntityAndSchema(db, workspace, entityId);
  requireArtifactWrite(authCtx, entity);
  const artifact = await db.artifact.getArtifact(workspace, artifactId);
  httpAssert.present(artifact, { status: 404, message: 'Artifact not found' });
  httpAssert.true(artifact.entity_id === entity.id, { status: 404, message: 'Artifact not found' });
  httpAssert.true(artifact.artifact_type === 'api-specification', {
    status: 409,
    message: 'Only API specification artifacts can be refreshed'
  });
  httpAssert.true(artifact.kind === 'url', {
    status: 409,
    message: 'Only URL artifacts can be refreshed'
  });

  const timestamp = new Date();
  const refreshed = await db.core.transaction(async tx => {
    const attempt = await tx.artifact.beginAttempt(workspace, artifact.id, timestamp);
    httpAssert.present(attempt, { status: 404, message: 'Artifact not found' });
    if (attempt.started) {
      await enqueueApiSpecificationUrlRefresh(tx, workspace, artifact.id, timestamp);
    }
    return attempt.artifact;
  });
  return toArtifact(refreshed);
};

export const updateArtifact = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  artifactId: string,
  body: {
    status: ArtifactStatus;
    diagnostic?: {
      category: ArtifactDiagnosticCategory;
      message: string;
      timestamp: string;
    } | null;
  },
  authCtx: AuthorizationContext
) => {
  const { entity } = await getEntityAndSchema(db, workspace, entityId);
  requireArtifactWrite(authCtx, entity);
  const artifact = await db.artifact.getArtifact(workspace, artifactId);
  httpAssert.present(artifact, { status: 404, message: 'Artifact not found' });
  httpAssert.true(artifact.entity_id === entity.id, { status: 404, message: 'Artifact not found' });
  httpAssert.true(body.status !== 'current' || artifact.current_revision_id != null, {
    status: 409,
    message: 'An artifact cannot be current without a successful revision'
  });
  httpAssert.true(body.status !== 'link_only' || artifact.kind === 'link', {
    status: 409,
    message: 'Only link artifacts can use link_only status'
  });
  const timestamp = new Date();
  return toArtifact(
    (await db.artifact.updateArtifact(workspace, artifact.id, {
      status: body.status,
      diagnostic: body.diagnostic
        ? { category: body.diagnostic.category, message: body.diagnostic.message, timestamp }
        : null,
      last_attempt_at: timestamp,
      updated_at: timestamp
    }))!
  );
};

export const ingestArtifactRevision = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  artifactId: string,
  body: ArtifactRevisionInput
) => {
  const { schema } = await getEntityAndSchema(db, workspace, entityId);
  const artifact = await db.artifact.getArtifact(workspace, artifactId);
  httpAssert.present(artifact, { status: 404, message: 'Artifact not found' });
  httpAssert.true(artifact.entity_id === entityId, { status: 404, message: 'Artifact not found' });
  httpAssert.true(artifact.kind !== 'link', {
    status: 409,
    message: 'Link artifacts cannot store a document revision'
  });
  httpAssert.true(Buffer.byteLength(body.content, 'utf8') <= MAX_ARTIFACT_BYTES, {
    status: 413,
    message: 'Artifact content exceeds the 2 MB limit'
  });
  assertEntityCapabilityForArtifact(schema, artifact.artifact_type);
  const checksum = createHash('sha256').update(body.content, 'utf8').digest('hex');
  const existing = await db.artifact.getRevisionByChecksum(workspace, artifact.id, checksum);
  const revisionId = existing?.id ?? randomUUID();
  const timestamp = new Date();
  const processor = db.artifactProcessors.get(artifact.artifact_type);
  const processing =
    processor == null
      ? null
      : await processor.processRevision({
          revisionId,
          content: body.content,
          mediaType: body.mediaType ?? artifact.media_type,
          timestamp
        });
  if (existing) {
    if (processing) {
      await db.core.transaction(async tx => {
        await processing.persist(tx, { workspace, revisionId: existing.id, timestamp });
        await tx.artifact.updateArtifact(workspace, artifact.id, {
          status: processing.status,
          media_type: body.mediaType ?? artifact.media_type,
          current_revision_id:
            processing.status === 'current' ? existing.id : artifact.current_revision_id,
          last_attempt_at: timestamp,
          last_success_at: processing.status === 'current' ? timestamp : artifact.last_success_at,
          diagnostic: processing.diagnostic,
          updated_at: timestamp
        });
      });
    }
    return toRevision(existing);
  }

  const revision = await db.core.transaction(async tx => {
    const created = await tx.artifact.createRevision({
      id: revisionId,
      workspace,
      artifact_id: artifact.id,
      source_revision: body.sourceRevision ?? null,
      checksum,
      media_type: body.mediaType ?? artifact.media_type,
      content: body.content,
      created_at: timestamp
    });
    if (processing) {
      await processing.persist(tx, { workspace, revisionId: created.id, timestamp });
    }
    await tx.artifact.updateArtifact(workspace, artifact.id, {
      status: processing?.status ?? 'current',
      media_type: body.mediaType ?? artifact.media_type,
      current_revision_id:
        processing?.status === 'current' || processing == null
          ? created.id
          : artifact.current_revision_id,
      last_attempt_at: timestamp,
      last_success_at:
        processing == null || processing.status === 'current'
          ? timestamp
          : artifact.last_success_at,
      diagnostic: processing?.diagnostic ?? null,
      updated_at: timestamp
    });
    return created;
  });
  return toRevision(revision);
};

export const createArtifactRevision = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  artifactId: string,
  body: ArtifactRevisionInput,
  authCtx: AuthorizationContext
) => {
  const { entity } = await getEntityAndSchema(db, workspace, entityId);
  requireArtifactWrite(authCtx, entity);
  return ingestArtifactRevision(db, workspace, entity.id, artifactId, body);
};

export const recordArtifactFetchFailure = async (
  db: DatabaseAdapter,
  workspace: string,
  artifactId: string,
  diagnostic: {
    category: ArtifactDiagnosticCategory;
    message: string;
  },
  timestamp = new Date()
) => {
  const artifact = await db.artifact.getArtifact(workspace, artifactId);
  if (!artifact) return null;
  const status: ArtifactStatus = artifact.current_revision_id ? 'stale' : 'failed';
  const updated = await db.artifact.updateArtifact(workspace, artifact.id, {
    status,
    diagnostic: { category: diagnostic.category, message: diagnostic.message, timestamp },
    last_attempt_at: timestamp,
    updated_at: timestamp
  });
  return updated ? toArtifact(updated) : null;
};

export const getArtifactRevisionContent = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  artifactId: string,
  revisionId: string,
  authCtx: AuthorizationContext
) => {
  const { entity } = await getEntityAndSchema(db, workspace, entityId);
  requireEntityView(authCtx, entity);
  requireWorkspaceCapability(
    authCtx,
    'artifact.content.view',
    'You do not have permission to view raw artifact content'
  );
  const revision = await db.artifact.getRevision(workspace, revisionId);
  httpAssert.present(revision, { status: 404, message: 'Artifact revision not found' });
  httpAssert.true(revision.artifact_id === artifactId, {
    status: 404,
    message: 'Artifact revision not found'
  });
  const artifact = await db.artifact.getArtifact(workspace, revision.artifact_id);
  httpAssert.present(artifact, { status: 404, message: 'Artifact not found' });
  httpAssert.true(artifact.entity_id === entity.id, {
    status: 404,
    message: 'Artifact revision not found'
  });
  return { ...toRevision(revision), content: revision.content };
};
