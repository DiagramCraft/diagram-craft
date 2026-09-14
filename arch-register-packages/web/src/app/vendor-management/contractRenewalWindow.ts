/**
 * Buckets a Contract's `contract_end` into a renewal-window facet — shared by the Contracts list's
 * search/facet filtering, `VendorManagementSidebar`'s Contracts facets, and the renewal calendar's
 * overdue highlighting. Pure date-diff logic, string-compared on the `YYYY-MM-DD` date-only value
 * (same style as `useVendorNextRenewals.ts`'s `nextRenewalDate`), no fetching.
 */
export type RenewalWindow = 'overdue' | 'next30' | 'next90' | 'next365' | 'later' | 'none';

export const RENEWAL_WINDOWS: { id: RenewalWindow; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'next30', label: 'Next 30 days' },
  { id: 'next90', label: 'Next 90 days' },
  { id: 'next365', label: 'Next 12 months' },
  { id: 'later', label: 'Beyond 12 months' },
  { id: 'none', label: 'No end date' }
];

/** Shared window → color mapping, used by both the Contracts list and renewal calendar — mirrors
 *  `vendorRisk.ts`'s `VENDOR_RISK_BAND_COLOR`. */
export const RENEWAL_WINDOW_COLOR: Record<RenewalWindow, string> = {
  overdue: 'var(--cmp-fg-danger, #ef4444)',
  next30: 'var(--cmp-fg-warning, #eab308)',
  next90: 'var(--cmp-fg-warning, #eab308)',
  next365: 'var(--cmp-fg-success, #22c55e)',
  later: 'var(--cmp-fg-success, #22c55e)',
  none: 'var(--text-muted, #9ca3af)'
};

const addDays = (date: Date, days: number): string => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
};

/**
 * `contractEnd` is a `YYYY-MM-DD` date-only string (or `null`/undefined for an open-ended
 * contract). `today` defaults to now, overridable for tests.
 */
export const renewalWindow = (
  contractEnd: string | null | undefined,
  today: Date = new Date()
): RenewalWindow => {
  if (!contractEnd) return 'none';
  const end = contractEnd.slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  if (end < todayStr) return 'overdue';
  if (end <= addDays(today, 30)) return 'next30';
  if (end <= addDays(today, 90)) return 'next90';
  if (end <= addDays(today, 365)) return 'next365';
  return 'later';
};
