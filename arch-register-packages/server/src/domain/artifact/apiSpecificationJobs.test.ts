import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { ArtifactDbResult } from './db/artifactDatabase';
import { RetryableJobError } from '../jobs/jobRetry';
import { UrlSourceFetchError } from './urlSourceFetcher';
import { createApiSpecificationUrlRefreshJobHandler } from './apiSpecificationJobs';

const mocks = vi.hoisted(() => ({
  fetchUrlSource: vi.fn(),
  ingestArtifactRevision: vi.fn(),
  recordArtifactFetchFailure: vi.fn()
}));

vi.mock('./urlSourceFetcher', async importOriginal => {
  const actual = await importOriginal<typeof import('./urlSourceFetcher')>();
  return { ...actual, fetchUrlSource: mocks.fetchUrlSource };
});

vi.mock('./artifactOperations', () => ({
  API_SPECIFICATION_URL_REFRESH_JOB_TYPE: 'artifact.api-specification.refresh',
  ingestArtifactRevision: mocks.ingestArtifactRevision,
  recordArtifactFetchFailure: mocks.recordArtifactFetchFailure
}));

const makeArtifact = (overrides: Partial<ArtifactDbResult> = {}): ArtifactDbResult => ({
  id: 'artifact-1',
  workspace: 'workspace-1',
  entity_id: 'entity-1',
  artifact_type: 'api-specification',
  source_key: null,
  kind: 'url',
  refresh_schedule_id: null,
  location: 'https://example.test/openapi.yaml',
  media_type: null,
  status: 'current',
  current_revision_id: 'revision-1',
  last_attempt_at: null,
  last_success_at: new Date('2026-01-01T00:00:00.000Z'),
  diagnostic: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides
});

const makeDb = (artifact: ArtifactDbResult) => {
  const updated = vi.fn(async () => artifact);
  const db = {
    artifact: {
      getArtifact: vi.fn(async () => artifact),
      updateArtifact: updated
    }
  };
  return { db: db as unknown as DatabaseAdapter, updated };
};

const makeContext = (overrides: Record<string, unknown> = {}) => ({
  jobId: 'run-1',
  workspace: 'workspace-1',
  payload: { artifactId: 'artifact-1' },
  signal: new AbortController().signal,
  attemptCount: 1,
  maxAttempts: 3,
  ...overrides
});

describe('API specification URL refresh job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchUrlSource.mockResolvedValue({
      content: '{"openapi":"3.1.0"}',
      mediaType: 'application/json',
      sourceRevision: '"spec-1"'
    });
    mocks.ingestArtifactRevision.mockResolvedValue({ id: 'revision-2' });
  });

  it('fetches a URL source and ingests the returned document', async () => {
    const artifact = makeArtifact();
    const { db, updated } = makeDb(artifact);
    const handler = createApiSpecificationUrlRefreshJobHandler(db);

    await expect(handler(makeContext())).resolves.toMatchObject({
      artifactId: artifact.id,
      revisionId: 'revision-2',
      status: 'current'
    });
    expect(updated).toHaveBeenCalledWith(
      'workspace-1',
      artifact.id,
      expect.objectContaining({ status: 'pending', diagnostic: null })
    );
    expect(mocks.fetchUrlSource).toHaveBeenCalledWith(artifact.location, expect.any(AbortSignal));
    expect(mocks.ingestArtifactRevision).toHaveBeenCalledWith(
      db,
      'workspace-1',
      'entity-1',
      artifact.id,
      {
        content: '{"openapi":"3.1.0"}',
        mediaType: 'application/json',
        sourceRevision: '"spec-1"'
      }
    );
  });

  it('leaves the artifact pending while a transient failure is retried', async () => {
    const artifact = makeArtifact();
    const { db } = makeDb(artifact);
    const failure = new UrlSourceFetchError(
      'source_timeout',
      'URL source https://example.test/openapi.yaml timed out',
      true
    );
    mocks.fetchUrlSource.mockRejectedValueOnce(failure);
    const handler = createApiSpecificationUrlRefreshJobHandler(db);

    await expect(handler(makeContext())).rejects.toBeInstanceOf(RetryableJobError);
    expect(mocks.recordArtifactFetchFailure).not.toHaveBeenCalled();
  });

  it('records a safe terminal diagnostic after the final failed attempt', async () => {
    const artifact = makeArtifact();
    const { db } = makeDb(artifact);
    mocks.fetchUrlSource.mockRejectedValueOnce(
      new UrlSourceFetchError(
        'source_forbidden',
        'URL source https://example.test/openapi.yaml returned HTTP 403',
        false
      )
    );
    const handler = createApiSpecificationUrlRefreshJobHandler(db);

    await expect(handler(makeContext({ attemptCount: 3, maxAttempts: 3 }))).rejects.toMatchObject({
      category: 'source_forbidden'
    });
    expect(mocks.recordArtifactFetchFailure).toHaveBeenCalledWith(db, 'workspace-1', artifact.id, {
      category: 'source_forbidden',
      message: 'URL source [redacted-url] returned HTTP 403',
      retryable: false
    });
  });

  it('skips artifacts that are not URL API specification sources', async () => {
    const { db } = makeDb(makeArtifact({ kind: 'link' }));
    const handler = createApiSpecificationUrlRefreshJobHandler(db);

    await expect(handler(makeContext())).resolves.toEqual({
      skipped: true,
      reason: 'artifact_is_not_url_api_specification'
    });
    expect(mocks.fetchUrlSource).not.toHaveBeenCalled();
  });
});
