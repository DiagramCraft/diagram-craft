import { describe, expect, it } from 'vitest';
import { computeDatasetCoverage, computeDatasetCoverageSummary } from './datasetCoverage';

const COVERED = {
  owner: { id: 'team-1', name: 'Payments' },
  steward: { principal_type: 'user', principal_id: 'user-1' },
  classification: 'confidential',
  reviewStatus: 'current'
};

describe('computeDatasetCoverage', () => {
  it('is covered when owner, steward, classification and a current review are all present', () => {
    expect(computeDatasetCoverage(COVERED)).toEqual({ dsCovered: true, dsGaps: [] });
  });

  it('flags a missing owner', () => {
    expect(computeDatasetCoverage({ ...COVERED, owner: null }).dsGaps).toEqual(['no-owner']);
  });

  it('flags a missing steward', () => {
    expect(computeDatasetCoverage({ ...COVERED, steward: null }).dsGaps).toEqual(['no-steward']);
  });

  it('flags a missing classification', () => {
    expect(computeDatasetCoverage({ ...COVERED, classification: null }).dsGaps).toEqual([
      'classification-unconfirmed'
    ]);
  });

  it('flags an empty-string classification', () => {
    expect(computeDatasetCoverage({ ...COVERED, classification: '' }).dsGaps).toEqual([
      'classification-unconfirmed'
    ]);
  });

  it.each(['incomplete', 'overdue', 'approaching', null, undefined])(
    'treats review_status %s as a gap (only "current" counts as inside cycle)',
    reviewStatus => {
      expect(computeDatasetCoverage({ ...COVERED, reviewStatus }).dsGaps).toEqual([
        'review-not-current'
      ]);
    }
  );

  it('reports every gap at once when nothing is set', () => {
    const result = computeDatasetCoverage({
      owner: null,
      steward: null,
      classification: null,
      reviewStatus: null
    });
    expect(result.dsCovered).toBe(false);
    expect(result.dsGaps).toEqual([
      'no-owner',
      'no-steward',
      'classification-unconfirmed',
      'review-not-current'
    ]);
  });
});

describe('computeDatasetCoverageSummary', () => {
  it('returns a single "All datasets" bucket counting covered vs. total', () => {
    const summary = computeDatasetCoverageSummary([COVERED, { ...COVERED, owner: null }, COVERED]);
    expect(summary).toEqual([{ domain: 'All datasets', covered: 2, total: 3 }]);
  });

  it('handles an empty input list', () => {
    expect(computeDatasetCoverageSummary([])).toEqual([
      { domain: 'All datasets', covered: 0, total: 0 }
    ]);
  });
});
