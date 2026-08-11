import { createHash, randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@arch-register/permissions';
import type {
  ApiSpecificationSyncBody,
  ApiSpecificationSyncResult
} from '@arch-register/api-types/apiSpecificationSyncContract';
import type { ArtifactDbResult } from './db/artifactDatabase';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityMutationActor } from '../catalog/entityMutations';
import { httpAssert } from '../../utils/httpAssert';
import { handleError } from '../catalog/dataHelpers';
import { requireEntityAction, requireWorkspaceCapability } from '../auth/authorization';
import {
  API_SPECIFICATION_URL_REFRESH_JOB_TYPE,
  API_SPECIFICATION_URL_REFRESH_SYSTEM_IDENTITY,
  assertEntityCapabilityForArtifact,
  assertSafeSourceLocation,
  enqueueApiSpecificationUrlRefresh,
  getEntityAndSchema,
  ingestArtifactRevisionInTransaction,
  toArtifact
} from './artifactOperations';
import { createJobSchedule, updateJobSchedule } from '../jobs/jobOperations';
import { runEntitySyncInTransaction } from '../externalIdentity/entitySyncOperations';

const API_SPECIFICATION_ARTIFACT_TYPE = 'api-specification' as const;
const MAX_SOURCE_LENGTH = 200;
const MAX_EXTERNAL_KEY_LENGTH = 500;

const validateExternalIdentity = (source: string, externalKey: string) => {
  httpAssert.string(source, { status: 400, message: 'source is required' });
  httpAssert.true(source.length <= MAX_SOURCE_LENGTH, {
    status: 400,
    message: `source must be at most ${MAX_SOURCE_LENGTH} characters`
  });
  httpAssert.string(externalKey, { status: 400, message: 'externalKey is required' });
  httpAssert.true(externalKey.length <= MAX_EXTERNAL_KEY_LENGTH, {
    status: 400,
    message: `externalKey must be at most ${MAX_EXTERNAL_KEY_LENGTH} characters`
  });
};

const initialStatus = (kind: 'document' | 'url' | 'link') =>
  kind === 'link' ? ('link_only' as const) : ('pending' as const);

const sourceMetadataChanged = (
  existing: ArtifactDbResult,
  source: Extract<ApiSpecificationSyncBody['source'], { state: 'present' }>['source']
) =>
  existing.kind !== source.kind ||
  existing.location !== (source.location ?? null) ||
  existing.media_type !== (source.mediaType ?? null);

const disableExistingSchedule = async (
  db: DatabaseAdapter,
  scheduleId: string | null | undefined,
  now: Date
) => {
  if (scheduleId) await updateJobSchedule(db, scheduleId, { enabled: false }, now);
};

const ensureUrlSchedule = async (
  db: DatabaseAdapter,
  workspace: string,
  artifact: ArtifactDbResult,
  refreshPolicy: Extract<
    Extract<ApiSpecificationSyncBody['source'], { state: 'present' }>['source'],
    { kind: 'url' }
  >['refreshPolicy'],
  sourceKey: string,
  now: Date
) => {
  const policy = refreshPolicy ?? { mode: 'manual' as const };
  if (policy.mode === 'manual') {
    await disableExistingSchedule(db, artifact.refresh_schedule_id, now);
    if (artifact.refresh_schedule_id) {
      return (
        (await db.artifact.updateArtifact(workspace, artifact.id, {
          refresh_schedule_id: null,
          updated_at: now
        })) ?? artifact
      );
    }
    return artifact;
  }

  const recurrence = { type: 'hours' as const, intervalHours: policy.intervalHours, startsAt: now };
  const schedule = artifact.refresh_schedule_id
    ? await updateJobSchedule(
        db,
        artifact.refresh_schedule_id,
        {
          enabled: true,
          payload: { artifactId: artifact.id, sourceKey },
          recurrence
        },
        now
      )
    : await createJobSchedule(
        db,
        {
          workspace,
          jobType: API_SPECIFICATION_URL_REFRESH_JOB_TYPE,
          systemIdentity: API_SPECIFICATION_URL_REFRESH_SYSTEM_IDENTITY,
          payload: { artifactId: artifact.id, sourceKey },
          priority: 5,
          recurrence
        },
        now
      );
  httpAssert.present(schedule, {
    status: 500,
    message: 'Failed to configure API specification refresh schedule'
  });

  return (
    (await db.artifact.updateArtifact(workspace, artifact.id, {
      refresh_schedule_id: schedule.id,
      updated_at: now
    })) ?? artifact
  );
};

const upsertArtifactSource = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  source: Extract<ApiSpecificationSyncBody['source'], { state: 'present' }>['source'],
  now: Date,
  requestId?: string
) => {
  const { schema } = await getEntityAndSchema(db, workspace, entityId);
  assertEntityCapabilityForArtifact(schema, API_SPECIFICATION_ARTIFACT_TYPE);
  const location = source.location ?? null;
  assertSafeSourceLocation(source.kind, location);
  const existing = await db.artifact.getArtifactBySourceKey(
    workspace,
    entityId,
    API_SPECIFICATION_ARTIFACT_TYPE,
    source.sourceKey
  );
  const metadataChanged = existing ? sourceMetadataChanged(existing, source) : true;

  let artifact = existing
    ? await db.artifact.updateArtifact(workspace, existing.id, {
        kind: source.kind,
        location,
        media_type: source.mediaType ?? null,
        status: source.kind === 'link' ? 'link_only' : existing.status,
        updated_at: now
      })
    : await db.artifact.createArtifact({
        id: randomUUID(),
        workspace,
        entity_id: entityId,
        artifact_type: API_SPECIFICATION_ARTIFACT_TYPE,
        source_key: source.sourceKey,
        kind: source.kind,
        location,
        media_type: source.mediaType ?? null,
        status: initialStatus(source.kind),
        refresh_schedule_id: null,
        created_at: now,
        updated_at: now
      });
  httpAssert.present(artifact, {
    status: 500,
    message: 'Failed to persist API specification source'
  });

  if (source.kind === 'url') {
    artifact = await ensureUrlSchedule(
      db,
      workspace,
      artifact,
      source.refreshPolicy,
      source.sourceKey,
      now
    );
    const shouldQueue = !existing || metadataChanged;
    if (shouldQueue) {
      const attempt = existing
        ? await db.artifact.beginAttempt(workspace, artifact.id, now)
        : { artifact, started: true };
      httpAssert.present(attempt, { status: 404, message: 'API specification source not found' });
      if (attempt.started) {
        const job = await enqueueApiSpecificationUrlRefresh(
          db,
          workspace,
          artifact.id,
          now,
          requestId
        );
        return {
          artifact: attempt.artifact,
          sourceStatus: 'queued' as const,
          revision: null,
          jobRunId: job.id,
          created: !existing,
          metadataChanged
        };
      }
    }
    return {
      artifact,
      sourceStatus: existing && !metadataChanged ? ('unchanged' as const) : ('queued' as const),
      revision: null,
      jobRunId: null,
      created: !existing,
      metadataChanged
    };
  }

  await disableExistingSchedule(db, artifact.refresh_schedule_id, now);
  if (artifact.refresh_schedule_id) {
    artifact =
      (await db.artifact.updateArtifact(workspace, artifact.id, {
        refresh_schedule_id: null,
        updated_at: now
      })) ?? artifact;
  }

  if (source.kind === 'link') {
    artifact =
      (await db.artifact.updateArtifact(workspace, artifact.id, {
        status: 'link_only',
        current_revision_id: null,
        last_success_at: null,
        updated_at: now
      })) ?? artifact;
    return {
      artifact,
      sourceStatus: existing && !metadataChanged ? ('unchanged' as const) : ('link_only' as const),
      revision: null,
      jobRunId: null,
      created: !existing,
      metadataChanged
    };
  }

  const previousRevisionId = artifact.current_revision_id;
  const checksum = createHash('sha256').update(source.content, 'utf8').digest('hex');
  const existingRevision = await db.artifact.getRevisionByChecksum(
    workspace,
    artifact.id,
    checksum
  );
  const revision = await ingestArtifactRevisionInTransaction(db, workspace, entityId, artifact.id, {
    content: source.content,
    mediaType: source.mediaType ?? null,
    sourceRevision: source.sourceRevision ?? null
  });
  const updatedArtifact = await db.artifact.getArtifact(workspace, artifact.id);
  httpAssert.present(updatedArtifact, {
    status: 500,
    message: 'API specification source disappeared'
  });
  return {
    artifact: updatedArtifact,
    sourceStatus: !existing
      ? ('created' as const)
      : previousRevisionId === revision.id || (previousRevisionId == null && existingRevision)
        ? ('unchanged' as const)
        : ('updated' as const),
    revision,
    jobRunId: null,
    created: !existing,
    metadataChanged
  };
};

const markSourceMissing = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  sourceKey: string,
  now: Date
) => {
  const artifact = await db.artifact.getArtifactBySourceKey(
    workspace,
    entityId,
    API_SPECIFICATION_ARTIFACT_TYPE,
    sourceKey
  );
  if (!artifact) {
    return {
      artifact: null,
      sourceStatus: 'missing' as const,
      revision: null,
      jobRunId: null
    };
  }
  await disableExistingSchedule(db, artifact.refresh_schedule_id, now);
  const updated = await db.artifact.updateArtifact(workspace, artifact.id, {
    status: artifact.current_revision_id ? 'stale' : 'failed',
    refresh_schedule_id: null,
    diagnostic: {
      category: 'source_disappeared',
      message: 'The source was not present in the completed external catalog scan',
      timestamp: now
    },
    last_attempt_at: now,
    updated_at: now
  });
  return {
    artifact: updated,
    sourceStatus: 'missing' as const,
    revision: null,
    jobRunId: null
  };
};

export const syncApiSpecificationByExternalKey = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  body: ApiSpecificationSyncBody,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<ApiSpecificationSyncResult> => {
  validateExternalIdentity(source, externalKey);
  if (authCtx) {
    requireWorkspaceCapability(
      authCtx,
      'artifact.manage',
      'You do not have permission to manage entity artifacts'
    );
  }
  const requestId = randomUUID();

  try {
    return await db.core.transaction(async tx => {
      const entityResult = await runEntitySyncInTransaction(
        tx,
        workspace,
        source,
        externalKey,
        body.entity as Record<string, unknown>,
        authCtx,
        actor,
        {
          api_specification_source_key:
            body.source?.state === 'present'
              ? body.source.source.sourceKey
              : body.source?.sourceKey,
          request_id: requestId
        }
      );

      const sourceResult = body.source
        ? body.source.state === 'present'
          ? await upsertArtifactSource(
              tx,
              workspace,
              entityResult.entity._uid,
              body.source.source,
              new Date(),
              requestId
            )
          : await markSourceMissing(
              tx,
              workspace,
              entityResult.entity._uid,
              body.source.sourceKey,
              new Date()
            )
        : null;

      return {
        status: entityResult.status,
        entity: entityResult.entity,
        sourceStatus: sourceResult?.sourceStatus ?? null,
        artifact: sourceResult?.artifact ? toArtifact(sourceResult.artifact) : null,
        revision: sourceResult?.revision ?? null,
        requestId,
        jobRunId: sourceResult?.jobRunId ?? null,
        warnings: []
      };
    });
  } catch (error) {
    return handleError(error, 'Failed to sync API specification');
  }
};

export const refreshApiSpecificationByExternalKey = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  sourceKey: string,
  authCtx: AuthorizationContext | null
) => {
  validateExternalIdentity(source, externalKey);
  if (authCtx) {
    requireWorkspaceCapability(
      authCtx,
      'artifact.manage',
      'You do not have permission to manage entity artifacts'
    );
  }
  const requestId = randomUUID();

  try {
    return await db.core.transaction(async tx => {
      const identity = await tx.externalIdentity.find(workspace, source, externalKey);
      httpAssert.present(identity, {
        status: 404,
        message: `Entity with external identity '${source}/${externalKey}' not found`
      });
      const entity = await tx.catalog.getEntity(workspace, identity.record_id);
      httpAssert.present(entity, { status: 404, message: 'Entity not found' });
      if (authCtx) {
        requireEntityAction(
          authCtx,
          entity,
          'edit_entity',
          'You do not have permission to edit this entity'
        );
      }
      const artifact = await tx.artifact.getArtifactBySourceKey(
        workspace,
        entity.id,
        API_SPECIFICATION_ARTIFACT_TYPE,
        sourceKey
      );
      httpAssert.present(artifact, { status: 404, message: 'API specification source not found' });
      httpAssert.true(artifact.kind === 'url', {
        status: 409,
        message: 'Only URL API specification sources can be refreshed'
      });
      const now = new Date();
      const attempt = await tx.artifact.beginAttempt(workspace, artifact.id, now);
      httpAssert.present(attempt, { status: 404, message: 'API specification source not found' });
      if (!attempt.started) {
        return {
          status: 'deduplicated' as const,
          artifact: toArtifact(attempt.artifact),
          requestId,
          jobRunId: null
        };
      }
      const job = await enqueueApiSpecificationUrlRefresh(
        tx,
        workspace,
        artifact.id,
        now,
        requestId
      );
      return {
        status: 'queued' as const,
        artifact: toArtifact(attempt.artifact),
        requestId,
        jobRunId: job.id
      };
    });
  } catch (error) {
    return handleError(error, 'Failed to refresh API specification');
  }
};
