import type { DatabaseAdapter } from '../../db/database';
import { RetryableJobError } from '../jobs/jobRetry';
import {
  API_SPECIFICATION_URL_REFRESH_JOB_TYPE,
  ingestArtifactRevision,
  recordArtifactFetchFailure
} from './artifactOperations';
import { fetchUrlSource, UrlSourceFetchError } from './urlSourceFetcher';

export type ApiSpecificationUrlRefreshJobContext = {
  jobId: string;
  workspace: string;
  payload: Record<string, unknown>;
  signal: AbortSignal;
  attemptCount: number;
  maxAttempts: number;
};

const isPayload = (payload: Record<string, unknown>): payload is { artifactId: string } =>
  typeof payload['artifactId'] === 'string' && payload['artifactId'].length > 0;

const safeMessage = (message: string) =>
  message.replace(/https?:\/\/\S+/gi, '[redacted-url]').slice(0, 500);

const createFailure = (error: unknown) => {
  if (error instanceof UrlSourceFetchError) {
    return {
      category: error.category,
      message: safeMessage(error.message),
      retryable: error.retryable
    };
  }
  return {
    category: 'source_unavailable' as const,
    message: 'URL source ingestion failed',
    retryable: false
  };
};

export const createApiSpecificationUrlRefreshJobHandler =
  (db: DatabaseAdapter) => async (context: ApiSpecificationUrlRefreshJobContext) => {
    if (!isPayload(context.payload))
      throw new Error('API specification refresh job has an invalid payload');

    const artifact = await db.artifact.getArtifact(context.workspace, context.payload.artifactId);
    if (!artifact) return { skipped: true, reason: 'artifact_not_found' };
    if (artifact.artifact_type !== 'api-specification' || artifact.kind !== 'url') {
      return { skipped: true, reason: 'artifact_is_not_url_api_specification' };
    }
    if (!artifact.location) {
      await recordArtifactFetchFailure(db, context.workspace, artifact.id, {
        category: 'invalid_source',
        message: 'URL source location is missing'
      });
      return { artifactId: artifact.id, status: 'failed' };
    }

    const startedAt = new Date();
    await db.artifact.updateArtifact(context.workspace, artifact.id, {
      status: 'pending',
      diagnostic: null,
      last_attempt_at: startedAt,
      updated_at: startedAt
    });

    try {
      const source = await fetchUrlSource(artifact.location, context.signal);
      if (context.signal.aborted) return { aborted: true };
      const revision = await ingestArtifactRevision(
        db,
        context.workspace,
        artifact.entity_id,
        artifact.id,
        {
          content: source.content,
          mediaType: source.mediaType,
          sourceRevision: source.sourceRevision
        }
      );
      const updated = await db.artifact.getArtifact(context.workspace, artifact.id);
      return {
        artifactId: artifact.id,
        revisionId: revision.id,
        status: updated?.status ?? 'current'
      };
    } catch (error) {
      if (context.signal.aborted) return { aborted: true };
      const failure = createFailure(error);
      if (failure.retryable && context.attemptCount < context.maxAttempts) {
        throw new RetryableJobError(failure.message);
      }
      await recordArtifactFetchFailure(db, context.workspace, artifact.id, failure);
      throw error instanceof Error ? error : new Error(failure.message);
    }
  };

export { API_SPECIFICATION_URL_REFRESH_JOB_TYPE };
