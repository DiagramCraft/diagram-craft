import { describe, expect, it } from 'vitest';
import type { ExternalMetadata, ExternalUpdateEnvelope } from '@arch-register/api-types/common';
import {
  applyExternalFieldUpdate,
  assertExternalUpdateOnlyChangesTarget,
  assertNoExternalFieldWrites,
  assertValidExternalUpdateTarget,
  isExternalField,
  outdateExternalMetadata
} from './externalMetadataHelpers';

describe('isExternalField', () => {
  it('is false when external_kind is absent', () => {
    expect(isExternalField({ id: 'name' })).toBe(false);
  });

  it('is true when external_kind is set', () => {
    expect(isExternalField({ id: 'riskScore', external_kind: 'automation' })).toBe(true);
  });
});

describe('assertNoExternalFieldWrites', () => {
  const fields = [
    { id: 'name' },
    { id: 'riskScore', external_kind: 'automation' as const },
    { id: 'tags', external_kind: 'ai' as const }
  ];

  it('allows changes to non-external fields', () => {
    expect(() =>
      assertNoExternalFieldWrites(fields, { name: 'a', riskScore: 1 }, { name: 'b', riskScore: 1 })
    ).not.toThrow();
  });

  it('allows an external field to stay unchanged', () => {
    expect(() =>
      assertNoExternalFieldWrites(fields, { riskScore: 5 }, { riskScore: 5 })
    ).not.toThrow();
  });

  it('treats missing and null the same as unchanged', () => {
    expect(() => assertNoExternalFieldWrites(fields, { riskScore: null }, {})).not.toThrow();
  });

  it('rejects a direct write to an external field', () => {
    expect(() => assertNoExternalFieldWrites(fields, { riskScore: 5 }, { riskScore: 6 })).toThrow(
      /riskScore/
    );
  });

  it('reports all changed external fields', () => {
    expect(() =>
      assertNoExternalFieldWrites(
        fields,
        { riskScore: 5, tags: ['a'] },
        { riskScore: 6, tags: ['b'] }
      )
    ).toThrow(/riskScore.*tags/);
  });

  it('treats reordered array values as unchanged', () => {
    expect(() =>
      assertNoExternalFieldWrites(fields, { tags: ['a', 'b'] }, { tags: ['b', 'a'] })
    ).not.toThrow();
  });
});

describe('outdateExternalMetadata', () => {
  const baseResult = {
    fieldId: 'riskScore',
    external_kind: 'automation' as const,
    status: 'success' as const,
    source: 'risk-calculator',
    timestamp: '2026-07-19T12:00:00.000Z'
  };

  it('marks success results as outdated', () => {
    const metadata: ExternalMetadata = { riskScore: baseResult };
    expect(outdateExternalMetadata(metadata)).toEqual({
      riskScore: { ...baseResult, status: 'outdated' }
    });
  });

  it('leaves already-outdated results untouched', () => {
    const metadata: ExternalMetadata = { riskScore: { ...baseResult, status: 'outdated' } };
    const result = outdateExternalMetadata(metadata);
    expect(result.riskScore).toBe(metadata.riskScore);
  });

  it('handles an empty metadata record', () => {
    expect(outdateExternalMetadata({})).toEqual({});
  });
});

describe('assertValidExternalUpdateTarget', () => {
  const fields = [
    { id: 'name' },
    { id: 'riskScore', external_kind: 'automation' as const },
    { id: 'tags', external_kind: 'ai' as const }
  ];
  const baseEnvelope: ExternalUpdateEnvelope = {
    fieldId: 'riskScore',
    kind: 'automation',
    source: 'risk-calculator',
    status: 'success'
  };

  it('accepts a matching field/kind and returns the remaining fields', () => {
    const remaining = assertValidExternalUpdateTarget(
      fields,
      baseEnvelope,
      { riskScore: 1 },
      { riskScore: 2 }
    );
    expect(remaining.map(field => field.id)).toEqual(['name', 'tags']);
  });

  it('rejects an unknown target field', () => {
    expect(() =>
      assertValidExternalUpdateTarget(fields, { ...baseEnvelope, fieldId: 'unknown' }, {}, {})
    ).toThrow(/unknown/);
  });

  it('rejects a kind mismatch with the target field', () => {
    expect(() =>
      assertValidExternalUpdateTarget(
        fields,
        { ...baseEnvelope, fieldId: 'tags', kind: 'automation' },
        {},
        {}
      )
    ).toThrow(/tags/);
  });

  it('rejects a failed update that changed the field value', () => {
    expect(() =>
      assertValidExternalUpdateTarget(
        fields,
        { ...baseEnvelope, status: 'failed' },
        { riskScore: 1 },
        { riskScore: 2 }
      )
    ).toThrow(/must not change/);
  });

  it('allows a failed update that left the field value unchanged', () => {
    expect(() =>
      assertValidExternalUpdateTarget(
        fields,
        { ...baseEnvelope, status: 'failed' },
        { riskScore: 1 },
        { riskScore: 1 }
      )
    ).not.toThrow();
  });
});

describe('assertExternalUpdateOnlyChangesTarget', () => {
  it('allows the declared target field to change', () => {
    expect(() =>
      assertExternalUpdateOnlyChangesTarget(
        'release',
        { repository: 'owner/repo', release: 'v1' },
        { repository: 'owner/repo', release: 'v2' }
      )
    ).not.toThrow();
  });

  it('rejects changes to another field', () => {
    expect(() =>
      assertExternalUpdateOnlyChangesTarget(
        'release',
        { repository: 'owner/repo', release: 'v1' },
        { repository: 'other/repo', release: 'v2' }
      )
    ).toThrow(/may only change field 'release'/);
  });

  it('treats reordered relation arrays as unchanged', () => {
    expect(() =>
      assertExternalUpdateOnlyChangesTarget(
        'release',
        { dependencies: ['a', 'b'], release: 'v1' },
        { dependencies: ['b', 'a'], release: 'v2' }
      )
    ).not.toThrow();
  });
});

describe('applyExternalFieldUpdate', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');
  const baseEnvelope: ExternalUpdateEnvelope = {
    fieldId: 'riskScore',
    kind: 'automation',
    source: 'risk-calculator',
    status: 'success'
  };

  it('builds a success result', () => {
    expect(applyExternalFieldUpdate('riskScore', baseEnvelope, now)).toEqual({
      fieldId: 'riskScore',
      external_kind: 'automation',
      status: 'success',
      source: 'risk-calculator',
      timestamp: '2026-07-19T12:00:00.000Z',
      explanation: null,
      findings: undefined,
      sourceVersion: null,
      requestId: null,
      failureNotice: null
    });
  });

  it('builds a failed result carrying the failure notice', () => {
    const envelope: ExternalUpdateEnvelope = {
      ...baseEnvelope,
      status: 'failed',
      failureNotice: 'Upstream timed out'
    };
    const result = applyExternalFieldUpdate('riskScore', envelope, now);
    expect(result.status).toBe('failed');
    expect(result.failureNotice).toBe('Upstream timed out');
  });

  it('omits the failure notice on a success result even if one was supplied', () => {
    const envelope: ExternalUpdateEnvelope = {
      ...baseEnvelope,
      status: 'success',
      failureNotice: 'stale value from a prior attempt'
    };
    expect(applyExternalFieldUpdate('riskScore', envelope, now).failureNotice).toBeNull();
  });
});
