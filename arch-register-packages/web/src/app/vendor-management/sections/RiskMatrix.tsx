import {
  VENDOR_RISK_BAND_COLOR,
  VENDOR_RISK_BANDS,
  VENDOR_RISK_BAND_LABEL,
  type VendorRiskBand
} from '../vendorRisk';
import styles from './RiskMatrix.module.css';

const CRITICALITY_LEVELS = [5, 4, 3, 2] as const;

// A cell is "hot" — worth a visual callout — when a highly critical vendor also scores
// elevated-or-worse risk, mirroring the design reference's `vendor-views.jsx` (`VMRisk`) exactly.
const isHot = (criticality: number, band: VendorRiskBand): boolean =>
  criticality >= 4 && (band === 'high' || band === 'elevated');

export type RiskMatrixVendor = { id: string; name: string };

/**
 * Criticality (rows, 5 down to 2 — criticality-1 vendors aren't broken out, matching the design
 * reference) × risk-band (columns, low to high) matrix. A fixed grid over a derived,
 * non-schema value (`vmRiskBand`), so this is a small bespoke component rather than the generic
 * `EntityBrowser` `HeatmapView`/`MatrixView` (those are tightly coupled to entity-browser view
 * config/rows and don't fit a fixed domain grid).
 *
 * Each cell lists the vendors that land in it as clickable name tags (not a bare count) — opening
 * a vendor's tag opens the shared vendor `EntityDrawer` directly, there is no cell-level filtering.
 */
export const RiskMatrix = ({
  vendorsByCell,
  onOpenVendor
}: {
  vendorsByCell: ReadonlyMap<string, readonly RiskMatrixVendor[]>;
  onOpenVendor: (id: string) => void;
}) => {
  const cellKey = (criticality: number, band: VendorRiskBand) => `${criticality}:${band}`;

  return (
    <div className={styles.matrix}>
      <div className={styles.corner}>
        <div>criticality ↓ / risk →</div>
      </div>
      {VENDOR_RISK_BANDS.map(({ band }) => (
        <div key={band} className={styles.columnHeader}>
          {VENDOR_RISK_BAND_LABEL[band]}
        </div>
      ))}
      {CRITICALITY_LEVELS.map(criticality => (
        <div key={criticality} className={styles.row}>
          <div className={styles.rowHeader}>{criticality}</div>
          {VENDOR_RISK_BANDS.map(({ band }) => {
            const vendors = vendorsByCell.get(cellKey(criticality, band)) ?? [];
            return (
              <div
                key={band}
                className={styles.cell}
                data-hot={isHot(criticality, band) || undefined}
                style={{ '--cell-color': VENDOR_RISK_BAND_COLOR[band] } as React.CSSProperties}
              >
                {vendors.map(vendor => (
                  <button
                    key={vendor.id}
                    type="button"
                    className={styles.tag}
                    onClick={() => onOpenVendor(vendor.id)}
                  >
                    {vendor.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
