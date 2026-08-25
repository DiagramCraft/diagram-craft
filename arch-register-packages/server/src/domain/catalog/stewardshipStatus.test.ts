import { describe, expect, it } from 'vitest';
import type { SchemaDbResult } from './db/catalogDatabase';
import {
  computeEntityGovernanceStatus,
  computeReviewStatus,
  computeStewardshipCompleteness
} from './stewardshipStatus';

const now = new Date('2026-08-25T00:00:00.000Z');

describe('computeReviewStatus', () => {
  it('is incomplete when the review date is missing or malformed', () => {
    expect(computeReviewStatus(null, now)).toBe('incomplete');
    expect(computeReviewStatus(undefined, now)).toBe('incomplete');
    expect(computeReviewStatus('not-a-date', now)).toBe('incomplete');
  });

  it('is active when well before the review date', () => {
    expect(computeReviewStatus('2027-01-01', now)).toBe('active');
  });

  it('is approaching within the 30-day window', () => {
    expect(computeReviewStatus('2026-09-10', now)).toBe('approaching');
  });

  it('is overdue once past the review date', () => {
    expect(computeReviewStatus('2025-06-01', now)).toBe('overdue');
  });
});

const stewardshipSchema = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Data Entity',
  description: '',
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'DE',
  created_at: now,
  updated_at: now,
  fields: [
    { id: 'steward', name: 'Steward', type: 'principal', requirementLevel: 'expected' },
    { id: 'custodian', name: 'Custodian', type: 'principal', requirementLevel: 'expected' },
    { id: 'review_date', name: 'Review Date', type: 'date', requirementLevel: 'expected' },
    { id: 'classification', name: 'Classification', type: 'select', enumId: 'pii-classification' }
  ]
} as unknown as SchemaDbResult;

const unrelatedSchema = {
  id: 'schema-2',
  workspace: 'ws-1',
  name: 'Technology',
  description: '',
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'TECH',
  created_at: now,
  updated_at: now,
  fields: [{ id: 'product', name: 'Product', type: 'text' }]
} as unknown as SchemaDbResult;

describe('computeStewardshipCompleteness', () => {
  it('reports missing steward/custodian when a schema opted into the field group', () => {
    const result = computeStewardshipCompleteness({ owner: 'team-a', data: {} }, stewardshipSchema);
    expect(result.notApplicable).toBe(false);
    expect(result.missingOwner).toBe(false);
    expect(result.missingFieldIds).toEqual(['steward', 'custodian']);
  });

  it('reports missing owner separately from missing stewardship fields', () => {
    const result = computeStewardshipCompleteness(
      {
        owner: null,
        data: {
          steward: { principal_type: 'user', principal_id: 'user-1' },
          custodian: { principal_type: 'team', principal_id: 'team-1' }
        }
      },
      stewardshipSchema
    );
    expect(result.missingOwner).toBe(true);
    expect(result.missingFieldIds).toEqual([]);
  });

  it('is not applicable for a schema that never included the stewardship field group', () => {
    const result = computeStewardshipCompleteness({ owner: 'team-a', data: {} }, unrelatedSchema);
    expect(result.notApplicable).toBe(true);
    expect(result.missingFieldIds).toEqual([]);
  });
});

describe('computeEntityGovernanceStatus', () => {
  it('combines review status and stewardship completeness for a governed entity', () => {
    const result = computeEntityGovernanceStatus(
      {
        owner: 'team-a',
        data: {
          steward: { principal_type: 'user', principal_id: 'user-1' },
          custodian: { principal_type: 'team', principal_id: 'team-1' },
          review_date: '2025-06-01'
        }
      },
      stewardshipSchema,
      now
    );
    expect(result.reviewStatus).toBe('overdue');
    expect(result.stewardship.notApplicable).toBe(false);
    expect(result.stewardship.missingFieldIds).toEqual([]);
  });

  it('is not applicable for a schema without a review date field', () => {
    const result = computeEntityGovernanceStatus(
      { owner: 'team-a', data: {} },
      unrelatedSchema,
      now
    );
    expect(result.reviewStatus).toBe('incomplete');
    expect(result.stewardship.notApplicable).toBe(true);
  });
});
