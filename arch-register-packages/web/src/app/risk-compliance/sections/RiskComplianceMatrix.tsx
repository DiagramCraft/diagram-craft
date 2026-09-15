import type { CSSProperties } from 'react';
import {
  RESIDUAL_RISK_BAND_COLOR,
  RESIDUAL_RISK_BAND_LABEL,
  RESIDUAL_RISK_BANDS,
  residualRiskBand
} from '../residualRiskBand';
import styles from './RiskComplianceMatrix.module.css';

const LIKELIHOOD_LEVELS = [1, 2, 3, 4, 5] as const;
const IMPACT_LEVELS = [5, 4, 3, 2, 1] as const;

// Descriptive labels for the numeric 1-5 axis levels, mirroring the design reference's
// `RC_L_LABELS`/`RC_I_LABELS` (`rc-data.jsx`).
const LIKELIHOOD_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'] as const;
const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'] as const;

const clampLevel = (value: number): number => Math.min(5, Math.max(1, Math.round(value)));

// A cell is outside risk appetite when its likelihood × impact lands in the high/critical band —
// the same threshold the sidebar's "Outside appetite" facet uses (`residualRiskBand.ts`), mirrors
// the design reference's `RC_APPETITE` cell outline.
const isOutsideAppetite = (likelihood: number, impact: number): boolean => {
  const band = residualRiskBand(likelihood * impact);
  return band === 'high' || band === 'critical';
};

export type RiskComplianceMatrixRisk = {
  id: string;
  name: string;
  likelihood: number | null;
  impact: number | null;
  residualRiskScore: number | null;
};

/**
 * Likelihood (columns, 1-5) × impact (rows, 5 down to 1) 5×5 grid, built as a shared component so
 * both the Risks register (#3280) and the Overview landing screen (#3285) can embed it —
 * mirrors `../../vendor-management/sections/RiskMatrix.tsx`'s bespoke-grid approach (a fixed
 * domain grid doesn't fit the generic `EntityBrowser` heatmap/matrix views).
 *
 * The `residual` axis re-buckets the impact axis only: there's no separate residual
 * likelihood/impact field on the schema, only the single derived `residual_risk_score` (roughly
 * `likelihood × effectiveness-adjusted impact`, 0-25 — see `../residualRiskBand.ts`), so residual
 * impact is approximated as `residual_risk_score / likelihood`, clamped to the 1-5 grid. This is
 * an approximation of the schema's own approximation and isn't meant to be exact.
 *
 * Each cell chip shows the risk's own reference (`_publicId`), not its full name — the full name
 * is available as the chip's `title` tooltip — mirroring the design reference's `RCMatrix`
 * (`rc.jsx`), whose chips render `r.ref`.
 */
export const RiskComplianceMatrix = ({
  risks,
  axis,
  onOpenRisk
}: {
  risks: readonly RiskComplianceMatrixRisk[];
  axis: 'inherent' | 'residual';
  onOpenRisk: (id: string) => void;
}) => {
  const cellKey = (likelihood: number, impact: number) => `${likelihood}:${impact}`;

  const risksByCell = new Map<string, { id: string; name: string }[]>();
  for (const risk of risks) {
    if (risk.likelihood == null) continue;
    const likelihood = clampLevel(risk.likelihood);
    const impact =
      axis === 'inherent'
        ? risk.impact != null
          ? clampLevel(risk.impact)
          : null
        : risk.residualRiskScore != null
          ? clampLevel(risk.residualRiskScore / likelihood)
          : null;
    if (impact == null) continue;
    const key = cellKey(likelihood, impact);
    const list = risksByCell.get(key) ?? [];
    list.push({ id: risk.id, name: risk.name });
    risksByCell.set(key, list);
  }

  return (
    <div className={styles.scroll}>
      <div className={styles.matrix}>
        <div className={styles.corner}>
          <div>
            Impact ↑<br />
            Likelihood →
          </div>
        </div>
        {LIKELIHOOD_LEVELS.map(likelihood => (
          <div key={likelihood} className={styles.columnHeader}>
            {likelihood} · {LIKELIHOOD_LABELS[likelihood - 1]}
          </div>
        ))}
        {IMPACT_LEVELS.map(impact => (
          <div key={impact} className={styles.row}>
            <div className={styles.rowHeader}>
              {impact} · {IMPACT_LABELS[impact - 1]}
            </div>
            {LIKELIHOOD_LEVELS.map(likelihood => {
              const cellRisks = risksByCell.get(cellKey(likelihood, impact)) ?? [];
              const score = likelihood * impact;
              const band = residualRiskBand(score);
              return (
                <div
                  key={likelihood}
                  className={styles.cell}
                  data-outside-appetite={isOutsideAppetite(likelihood, impact) || undefined}
                  style={
                    {
                      '--cell-color': band ? RESIDUAL_RISK_BAND_COLOR[band] : 'var(--panel-border)'
                    } as CSSProperties
                  }
                >
                  {cellRisks.map(risk => (
                    <button
                      key={risk.id}
                      type="button"
                      className={styles.tag}
                      title={risk.name}
                      onClick={() => onOpenRisk(risk.id)}
                    >
                      {risk.id}
                    </button>
                  ))}
                  <span className={styles.score}>{score}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.foot}>
        <div className={styles.legend}>
          {RESIDUAL_RISK_BANDS.map(({ band }) => (
            <span key={band} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ background: RESIDUAL_RISK_BAND_COLOR[band] }}
              />
              {RESIDUAL_RISK_BAND_LABEL[band]}
            </span>
          ))}
        </div>
        <span className={styles.footNote}>
          Outlined cells are outside risk appetite — likelihood × impact above the high/critical
          threshold.
        </span>
      </div>
    </div>
  );
};
