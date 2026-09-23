/**
 * Coverage / gap computation for a single Information Asset (Data Entity), over fields already
 * shipped by #3064/#3065 — owner, steward, classification, and the derived `review_status`. No
 * relation traversal is involved (unlike Risk's server-derived multi-control coverage): every
 * field a dataset needs for coverage lives on the entity's own record.
 *
 * Two criteria from the original design (`dsGaps`/`dsCovered` in the design's `ds-data.jsx`) are
 * intentionally not computed here: a "quality above threshold" signal, because no quality field
 * or assessment has shipped anywhere yet, and per-domain grouping, because Data Entity has no
 * generic per-instance category/domain field. Both are documented gaps for a future issue, not
 * silently defaulted to pass or fail.
 */

export type DatasetCoverageGap =
  | 'no-owner'
  | 'no-steward'
  | 'classification-unconfirmed'
  | 'review-not-current';

export const DATASET_COVERAGE_GAP_LABEL: Record<DatasetCoverageGap, string> = {
  'no-owner': 'No named owner',
  'no-steward': 'No named steward',
  'classification-unconfirmed': 'Classification not confirmed',
  'review-not-current': 'Review not current'
};

export type DatasetCoverageInput = {
  /** `entity._owner` — `{id, name}` or `null`. */
  owner: unknown;
  /** `entity.steward` — a `principal` field value, or `null`. */
  steward: unknown;
  /** `entity.classification` — the `pii-classification` select value, or `null`/`''`. */
  classification: unknown;
  /** `entity.review_status` — derived: `'incomplete' | 'overdue' | 'approaching' | 'current'`. */
  reviewStatus: unknown;
};

export type DatasetCoverageResult = {
  dsCovered: boolean;
  dsGaps: DatasetCoverageGap[];
};

/**
 * A dataset counts as covered only when it has a named owner and steward, a confirmed
 * classification (a non-blank `classification` value — there is no separate confirmation flag),
 * and a review that is exactly `'current'` (not `'approaching'`, which still counts as a gap).
 */
export const computeDatasetCoverage = (input: DatasetCoverageInput): DatasetCoverageResult => {
  const gaps: DatasetCoverageGap[] = [];
  if (input.owner == null) gaps.push('no-owner');
  if (input.steward == null) gaps.push('no-steward');
  if (typeof input.classification !== 'string' || input.classification === '') {
    gaps.push('classification-unconfirmed');
  }
  if (input.reviewStatus !== 'current') gaps.push('review-not-current');
  return { dsCovered: gaps.length === 0, dsGaps: gaps };
};

export type DatasetCoverageDomainSummary = {
  domain: string;
  covered: number;
  total: number;
};

/**
 * `dsCoverageByDomain` equivalent — returns a single "All datasets" bucket, since Data Entity has
 * no generic per-instance domain/category field to group by. Callers should treat the single
 * bucket as a stand-in, not as evidence that domain grouping doesn't matter.
 */
export const computeDatasetCoverageSummary = (
  inputs: DatasetCoverageInput[]
): DatasetCoverageDomainSummary[] => [
  {
    domain: 'All datasets',
    covered: inputs.filter(input => computeDatasetCoverage(input).dsCovered).length,
    total: inputs.length
  }
];
