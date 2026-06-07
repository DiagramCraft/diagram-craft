import { describe, expect, it } from 'vitest';
import { buildAuditListFilters } from './audit.js';

describe('audit route helpers', () => {
  it('builds normalized audit filters from query params', () => {
    expect(
      buildAuditListFilters({
        entityType: 'entity',
        entityId: 'e-1',
        operation: 'update',
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-07T00:00:00.000Z',
        limit: '25',
        offset: '10'
      })
    ).toEqual({
      entityType: 'entity',
      entityId: 'e-1',
      operation: 'update',
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-07T00:00:00.000Z',
      limit: 25,
      offset: 10
    });
  });

  it('defaults missing values and rejects invalid pagination values', () => {
    expect(
      buildAuditListFilters({
        entityType: ['entity']
      })
    ).toEqual({
      entityType: null,
      entityId: null,
      operation: null,
      startDate: null,
      endDate: null,
      limit: 50,
      offset: 0
    });

    expect(() => buildAuditListFilters({ offset: '-1' })).toThrowError(
      'offset must be a non-negative integer'
    );
  });
});
