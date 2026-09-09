import type { CapabilityTableRollup } from './useCapabilityRollups';

/**
 * The Capability map's toolbar overlay dimensions. Every value is read from the shared
 * `useCapabilityRollups` output (subtree roll-ups over `business_capability` containment) — the
 * overlay only decides which number to show on a tile and how to colour it. Mirrors the design
 * reference's `BCM_OVERLAYS` (`bcm-data.jsx`).
 */
export type CapabilityMapOverlay =
  | 'none'
  | 'maturity'
  | 'gap'
  | 'investment'
  | 'risk'
  | 'coverage';

export const CAPABILITY_MAP_OVERLAYS: {
  id: CapabilityMapOverlay;
  label: string;
  /** Band labels, best-to-worst, for the toolbar legend. Empty for `none`. */
  legend: string[];
}[] = [
  { id: 'none', label: 'None', legend: [] },
  { id: 'maturity', label: 'Maturity', legend: ['4–5 Managed', '3 Defined', '1–2 Initial'] },
  { id: 'gap', label: 'Maturity gap', legend: ['On target', '< 1.5', '≥ 1.5'] },
  { id: 'investment', label: 'Investment', legend: ['< $200k', '$200k–600k', '≥ $600k'] },
  { id: 'risk', label: 'Risk', legend: ['1–2 Low', '3 Moderate', '4–5 Critical'] },
  { id: 'coverage', label: 'Application coverage', legend: ['3+ apps', '1–2 apps', 'No app'] }
];

// The app's real token set (`packages/main/src/tokens.css`) carries only three severity colours —
// `--green`, `--warning-fg`, `--error-fg` — so overlays band into those three tiers rather than the
// design reference's 5-step oklch ramp. Same convention as `CapabilityMaturityBar.tsx`'s
// `heatColor`. Index 0 = best, 2 = worst.
const BAND_COLORS = ['var(--green)', 'var(--warning-fg)', 'var(--error-fg, #e05252)'];

const compactMoney = (amount: number): string =>
  amount >= 1_000_000
    ? `$${(amount / 1_000_000).toFixed(1)}m`
    : amount >= 1_000
      ? `$${Math.round(amount / 1_000)}k`
      : `$${Math.round(amount)}`;

/**
 * The best-to-worst band (0, 1, 2) for a capability under `overlay`, or `null` when the roll-up
 * has no value for that dimension. Maturity and coverage read "higher is better"; gap, risk and
 * investment read "higher needs attention".
 */
export const overlayBand = (
  overlay: CapabilityMapOverlay,
  rollup: CapabilityTableRollup
): 0 | 1 | 2 | null => {
  switch (overlay) {
    case 'maturity': {
      const v = rollup.avgMaturity;
      if (v == null) return null;
      return v >= 3.5 ? 0 : v >= 2.5 ? 1 : 2;
    }
    case 'gap': {
      const v = rollup.avgGap;
      if (v == null) return null;
      return v <= 0 ? 0 : v < 1.5 ? 1 : 2;
    }
    case 'risk': {
      const v = rollup.avgRisk;
      if (v == null) return null;
      return v <= 2.5 ? 0 : v < 3.5 ? 1 : 2;
    }
    case 'coverage': {
      const v = rollup.appsCount;
      if (v == null) return null;
      return v >= 3 ? 0 : v >= 1 ? 1 : 2;
    }
    case 'investment': {
      const v = rollup.sumAnnualInvestment;
      if (v == null) return null;
      return v < 200_000 ? 0 : v < 600_000 ? 1 : 2;
    }
    default:
      return null;
  }
};

/** The `--heat` colour for a tile under `overlay`, or `undefined` for `none` / missing data. */
export const overlayColor = (
  overlay: CapabilityMapOverlay,
  rollup: CapabilityTableRollup
): string | undefined => {
  const band = overlayBand(overlay, rollup);
  return band == null ? undefined : BAND_COLORS[band];
};

/** The value shown on the tile under `overlay`, or `null` for `none` / missing data. */
export const overlayValue = (
  overlay: CapabilityMapOverlay,
  rollup: CapabilityTableRollup
): string | null => {
  switch (overlay) {
    case 'maturity':
      return rollup.avgMaturity == null ? null : rollup.avgMaturity.toFixed(1);
    case 'gap':
      return rollup.avgGap == null
        ? null
        : rollup.avgGap > 0
          ? `+${rollup.avgGap.toFixed(1)}`
          : '—';
    case 'risk':
      return rollup.avgRisk == null ? null : rollup.avgRisk.toFixed(1);
    case 'coverage':
      return rollup.appsCount == null ? null : String(rollup.appsCount);
    case 'investment':
      return rollup.sumAnnualInvestment == null ? null : compactMoney(rollup.sumAnnualInvestment);
    default:
      return null;
  }
};
