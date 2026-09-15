/**
 * Multi-control coverage roll-up for a Risk, computed over its `risk-control` relations — each
 * already carrying its own `coverage` % (0-100) and `effectiveness` (none/partial/substantial/
 * full) per the shipped schema (`schemaTemplates.ts`'s `risk-compliance` template). Reads those
 * relation-level fields as-is rather than reworking the schema, per #3151's breakdown decision.
 *
 * Multiple controls mitigating one Risk are treated as independent, overlapping layers of
 * defense: each control's own effective coverage is weighted by how effective it is, and the
 * combined `rcCoverage` is the probability that at least one layer catches the risk — not a
 * plain average, which would understate coverage for a Risk with several partially-effective
 * controls.
 */

export type RiskMitigationEffectiveness = 'none' | 'partial' | 'substantial' | 'full';

/** Weight applied to a relation's raw `coverage` % before combining across controls. */
export const EFFECTIVENESS_WEIGHT: Record<RiskMitigationEffectiveness, number> = {
  none: 0,
  partial: 0.5,
  substantial: 0.75,
  full: 1
};

export type CoverageBand = 'uncovered' | 'partial' | 'adequate' | 'strong';

/** Ordered ascending thresholds on the 0-100 `rcCoverage` scale — the band a score falls into is
 *  the last one whose `min` it meets or exceeds. A score of exactly 0 (no relations, or every
 *  relation's effectiveness is 'none') is 'uncovered'; anything above that but under 40 is
 *  'partial'. */
export const COVERAGE_BANDS: { band: CoverageBand; min: number }[] = [
  { band: 'uncovered', min: -Infinity },
  { band: 'partial', min: 0.01 },
  { band: 'adequate', min: 40 },
  { band: 'strong', min: 75 }
];

export const COVERAGE_BAND_COLOR: Record<CoverageBand, string> = {
  uncovered: 'var(--cmp-fg-danger, #ef4444)',
  partial: 'var(--cmp-fg-warning, #eab308)',
  adequate: 'var(--cmp-fg-dim, #9ca3af)',
  strong: 'var(--cmp-fg-success, #22c55e)'
};

export const COVERAGE_BAND_LABEL: Record<CoverageBand, string> = {
  uncovered: 'Uncovered',
  partial: 'Partial',
  adequate: 'Adequate',
  strong: 'Strong'
};

export type RiskCoverageInput = { coverage: number | null; effectiveness: string | null }[];

export type RiskCoverageResult = {
  rcCoverage: number | null;
  rcBand: CoverageBand | null;
};

const isEffectiveness = (value: string | null): value is RiskMitigationEffectiveness =>
  value != null && value in EFFECTIVENESS_WEIGHT;

const bandFor = (rcCoverage: number): CoverageBand => {
  let result: CoverageBand = 'uncovered';
  for (const { band, min } of COVERAGE_BANDS) {
    if (rcCoverage >= min) result = band;
  }
  return result;
};

/**
 * Combines a Risk's `risk-control` relations into one `rcCoverage`/`rcBand`. A relation with a
 * missing `coverage` or an unrecognized `effectiveness` is skipped entirely (not treated as 0
 * coverage) — if every relation is unusable this returns the same `{null, null}` as having no
 * relations at all, since there's nothing to report either way.
 */
export const computeRiskCoverage = (relations: RiskCoverageInput): RiskCoverageResult => {
  const usable = relations.filter(
    (relation): relation is { coverage: number; effectiveness: RiskMitigationEffectiveness } =>
      relation.coverage != null && isEffectiveness(relation.effectiveness)
  );
  if (usable.length === 0) return { rcCoverage: null, rcBand: null };

  const uncoveredFraction = usable.reduce((product, { coverage, effectiveness }) => {
    const effectiveCoverage = (coverage * EFFECTIVENESS_WEIGHT[effectiveness]) / 100;
    return product * (1 - effectiveCoverage);
  }, 1);

  const rcCoverage = Math.round((1 - uncoveredFraction) * 100 * 100) / 100;
  return { rcCoverage, rcBand: bandFor(rcCoverage) };
};
