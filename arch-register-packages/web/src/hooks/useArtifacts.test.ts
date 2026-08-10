import { describe, expect, it } from 'vitest';
import {
  getArtifactStatusLabel,
  selectApiSpecificationArtifact,
  selectApiSpecificationArtifacts
} from './useArtifacts';
import type { Artifact } from '@arch-register/api-types/artifactContract';

const artifact = (overrides: Partial<Artifact>): Artifact => ({
  id: 'artifact-1',
  workspace: 'workspace-1',
  entityId: 'entity-1',
  artifactType: 'api-specification',
  kind: 'document',
  location: null,
  mediaType: 'application/json',
  status: 'current',
  currentRevisionId: 'revision-1',
  lastAttemptAt: null,
  lastSuccessAt: null,
  diagnostic: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

describe('artifact presentation helpers', () => {
  it('selects the most recently updated API specification artifact', () => {
    const selected = selectApiSpecificationArtifact([
      artifact({ id: 'older', updatedAt: '2026-01-01T00:00:00.000Z' }),
      artifact({ id: 'newer', updatedAt: '2026-02-01T00:00:00.000Z' }),
      artifact({ id: 'other', artifactType: 'compliance-evidence' })
    ]);

    expect(selected?.id).toBe('newer');
    expect(selectApiSpecificationArtifacts([])).toEqual([]);
  });

  it('formats lifecycle states for the API status presentation', () => {
    expect(getArtifactStatusLabel('stale')).toBe('Stale');
    expect(getArtifactStatusLabel('link_only')).toBe('Link only');
  });
});
