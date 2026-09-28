import { useMemo } from 'react';
import {
  VENDOR_RISK_BAND_COLOR,
  VENDOR_RISK_BANDS,
  VENDOR_RISK_BAND_LABEL,
  type VendorRiskBand
} from '../vendorRisk';
import { MatrixGrid, type MatrixGridItem } from '../../../components/MatrixGrid';

const CRITICALITY_LEVELS = [5, 4, 3, 2] as const;

// A cell is "hot" — worth a visual callout — when a highly critical vendor also scores
// elevated-or-worse risk, mirroring the design reference's `vendor-views.jsx` (`VMRisk`) exactly.
const isHot = (criticality: number, band: VendorRiskBand): boolean =>
  criticality >= 4 && (band === 'high' || band === 'elevated');

export type RiskMatrixVendor = { id: string; name: string };

/**
 * Criticality (rows, 5 down to 2 — criticality-1 vendors aren't broken out, matching the design
 * reference) × risk-band (columns, low to high) matrix. A fixed grid over a derived,
 * UI-derived band from the Vendor schema's `risk` field, so this is a small bespoke component rather than the generic
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
  const items = useMemo(() => {
    const map = new Map<string, MatrixGridItem[]>();
    for (const [key, vendors] of vendorsByCell) {
      map.set(
        key,
        vendors.map(vendor => ({ id: vendor.id, label: vendor.name }))
      );
    }
    return map;
  }, [vendorsByCell]);

  return (
    <MatrixGrid
      cornerLabel="criticality ↓ / risk →"
      columns={VENDOR_RISK_BANDS.map(({ band }) => ({
        key: band,
        label: VENDOR_RISK_BAND_LABEL[band]
      }))}
      rows={CRITICALITY_LEVELS.map(criticality => ({ key: criticality, label: criticality }))}
      cells={items}
      getCellStyle={(criticality, band) => ({
        color: VENDOR_RISK_BAND_COLOR[band as VendorRiskBand],
        emphasized: isHot(Number(criticality), band as VendorRiskBand)
      })}
      onOpenItem={onOpenVendor}
      rowHeaderWidth={64}
      cellAspect={false}
    />
  );
};
