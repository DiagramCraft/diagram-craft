import { heatColor } from '../../../components/bandColor';
import styles from './CapabilityMaturityBar.module.css';

const pctOf = (value: number, max: number) => Math.min(100, Math.max(0, (value / max) * 100));

/**
 * Maturity bar + value for the Capabilities table's Maturity column: a filled track for the
 * roll-up's average `maturity` (0–`max`, `business_capability`'s schema-configured range, 1–5
 * today), color-banded red/amber/green by value, with the number to its right — mirrors the design
 * reference's `<span className="bcm-mat"><BCMBar/>…</span>` pairing in `BCMCapabilityList`
 * (`bcm-views.jsx`). Target is its own table column, not shown on this bar. Local to this screen —
 * no shared `ProgressBar` component exists yet (see
 * `sections/projects/components/AssessmentSummaryTab.tsx` for the one other, private, precedent
 * this borrows its track/fill shape from).
 */
export const CapabilityMaturityBar = ({
  maturity,
  max = 5
}: {
  maturity: number | null;
  max?: number;
}) => {
  if (maturity == null) {
    return <span className="dim">—</span>;
  }
  return (
    <span className={styles.cell}>
      <span className={styles.track} title={`Maturity ${maturity.toFixed(1)}`}>
        <span
          className={styles.fill}
          style={{ width: `${pctOf(maturity, max)}%`, background: heatColor(maturity) }}
        />
      </span>
      <span className="mono tabular">{maturity.toFixed(1)}</span>
    </span>
  );
};
