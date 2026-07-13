import { describe, expect, it } from 'vitest';
import { toEntityListQuery } from './entityListQuery';

describe('toEntityListQuery', () => {
  it('maps all shared entity-list options without React or query dependencies', () => {
    const conditions = [{ fieldId: '_name', op: 'contains' as const, value: 'Auth' }];

    expect(
      toEntityListQuery({
        schemaId: 'schema-1',
        owner: 'owner-1',
        lifecycle: 'active',
        q: 'auth',
        conditions,
        assessmentId: 'assessment-1',
        projectId: 'project-1',
        projectScope: 'project',
        asOf: '2026-07-11T00:00:00Z',
        includeProjectSnapshots: false
      })
    ).toEqual({
      _schemaId: 'schema-1',
      owner: 'owner-1',
      lifecycle: 'active',
      q: 'auth',
      conditions,
      assessmentId: 'assessment-1',
      projectId: 'project-1',
      projectScope: 'project',
      asOf: '2026-07-11T00:00:00Z',
      includeProjectSnapshots: false
    });
  });

  it('omits null, empty, and unspecified optional filters', () => {
    expect(
      toEntityListQuery({
        schemaId: null,
        owner: null,
        lifecycle: null,
        q: null,
        conditions: [],
        assessmentId: null,
        projectId: null,
        asOf: null,
        includeProjectSnapshots: null
      })
    ).toEqual({
      _schemaId: undefined,
      owner: undefined,
      lifecycle: undefined,
      q: undefined,
      conditions: undefined,
      assessmentId: undefined,
      projectId: undefined,
      projectScope: undefined,
      asOf: undefined,
      includeProjectSnapshots: undefined
    });
  });

  it('preserves false boolean filters', () => {
    expect(toEntityListQuery({ includeProjectSnapshots: false }).includeProjectSnapshots).toBe(
      false
    );
  });
});
