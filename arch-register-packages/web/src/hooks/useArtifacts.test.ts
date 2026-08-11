import { describe, expect, it } from 'vitest';
import {
  getArtifactStatusLabel,
  resolveApiSpecificationSelection,
  selectApiSpecificationArtifacts
} from './useArtifacts';
import type { ApiSpecificationRevision, Artifact } from '@arch-register/api-types/artifactContract';

const artifact = (overrides: Partial<Artifact>): Artifact => ({
  id: 'artifact-1',
  workspace: 'workspace-1',
  entityId: 'entity-1',
  artifactType: 'api-specification',
  sourceKey: null,
  kind: 'document',
  refreshScheduleId: null,
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
  it('keeps API sources distinct and orders them stably by creation time', () => {
    const selected = selectApiSpecificationArtifacts([
      artifact({ id: 'older', updatedAt: '2026-01-01T00:00:00.000Z' }),
      artifact({ id: 'newer', createdAt: '2026-02-01T00:00:00.000Z' }),
      artifact({ id: 'other', artifactType: 'compliance-evidence' })
    ]);

    expect(selected.map(item => item.id)).toEqual(['older', 'newer']);
    expect(selectApiSpecificationArtifacts([])).toEqual([]);
  });

  it('defaults a single source to its current revision but requires explicit selection across sources', () => {
    const revision = (id: string, isCurrent: boolean): ApiSpecificationRevision => ({
      revision: {
        id,
        artifactId: 'artifact-1',
        sourceRevision: id,
        checksum: id,
        mediaType: 'application/json',
        contentSize: 10,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      protocol: 'openapi',
      specificationVersion: '3.1.0',
      title: 'Example',
      description: null,
      status: 'current',
      isCurrent,
      itemCount: 1,
      diagnostics: []
    });
    const singleSource = {
      artifact: artifact({ id: 'artifact-1', currentRevisionId: 'revision-current' }),
      revisions: [revision('revision-current', true), revision('revision-old', false)]
    };
    const secondSource = {
      artifact: artifact({ id: 'artifact-2', currentRevisionId: 'revision-2' }),
      revisions: [revision('revision-2', true)]
    };

    expect(resolveApiSpecificationSelection([singleSource])).toMatchObject({
      artifact: { id: 'artifact-1' },
      revision: { revision: { id: 'revision-current' }, isCurrent: true }
    });
    expect(resolveApiSpecificationSelection([singleSource, secondSource])).toEqual({
      artifact: undefined,
      revision: undefined
    });
    expect(
      resolveApiSpecificationSelection([singleSource, secondSource], 'artifact-1', 'revision-old')
    ).toMatchObject({ revision: { revision: { id: 'revision-old' }, isCurrent: false } });
  });

  it('formats lifecycle states for the API status presentation', () => {
    expect(getArtifactStatusLabel('stale')).toBe('Stale');
    expect(getArtifactStatusLabel('link_only')).toBe('Link only');
  });
});
