import { VENDOR_RISK_BANDS, VENDOR_RISK_BAND_COLOR, type VendorRiskBand } from '../vendorRisk';
import styles from './RiskMatrix.module.css';

const CRITICALITY_LEVELS = [5, 4, 3, 2, 1] as const;

export type RiskMatrixCell = { criticality: number; band: VendorRiskBand; count: number };

/**
 * Criticality (rows, 5 down to 1) × risk-band (columns) matrix — a fixed 5×4 domain grid, so this
 * is a small bespoke component rather than the generic `EntityBrowser` `HeatmapView`/`MatrixView`
 * (those are tightly coupled to entity-browser view config/rows and don't fit a fixed grid over a
 * derived, non-schema value like `vmRiskBand`).
 *
 * Cells are colored by band (`VENDOR_RISK_BAND_COLOR`), shaded lighter when empty, and clickable —
 * `onCellClick` lets `VendorRiskScreen.tsx` filter its risk register table to that cell.
 */
export const RiskMatrix = ({
  cells,
  onCellClick,
  activeCriticality,
  activeBand
}: {
  cells: readonly RiskMatrixCell[];
  onCellClick: (criticality: number, band: VendorRiskBand) => void;
  activeCriticality?: number;
  activeBand?: VendorRiskBand;
}) => {
  const countFor = (criticality: number, band: VendorRiskBand) =>
    cells.find(cell => cell.criticality === criticality && cell.band === band)?.count ?? 0;

  return (
    <div className={styles.matrix}>
      <div className={styles.corner} />
      {VENDOR_RISK_BANDS.map(({ band }) => (
        <div key={band} className={styles.columnHeader}>
          {band}
        </div>
      ))}
      {CRITICALITY_LEVELS.map(criticality => (
        <div key={criticality} className={styles.row}>
          <div className={styles.rowHeader}>{criticality}</div>
          {VENDOR_RISK_BANDS.map(({ band }) => {
            const count = countFor(criticality, band);
            const active = activeCriticality === criticality && activeBand === band;
            return (
              <button
                key={band}
                type="button"
                className={styles.cell}
                data-active={active || undefined}
                data-empty={count === 0 || undefined}
                style={{ '--cell-color': VENDOR_RISK_BAND_COLOR[band] } as React.CSSProperties}
                onClick={() => onCellClick(criticality, band)}
                aria-label={`Criticality ${criticality}, ${band} risk: ${count} vendors`}
              >
                {count}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
