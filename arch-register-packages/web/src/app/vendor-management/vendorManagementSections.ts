/**
 * Vendor Management's rail-item ids, routes, and labels — split out from `vendorManagementShell.tsx`
 * so both it and `sections/VendorManagementSidebar.tsx` can depend on this leaf module without an
 * import cycle (the sidebar is rendered by `vendorManagementShell.tsx`'s `primarySidebar`
 * factories, and also needs the ids/routes to navigate between sections). Mirrors
 * `../strategy-model/strategySections.ts`.
 */
export const VENDOR_OVERVIEW_ID = 'vendor-overview' as const;
export const VENDOR_VENDORS_ID = 'vendor-vendors' as const;
export const VENDOR_CONTRACTS_ID = 'vendor-contracts' as const;
export const VENDOR_SPEND_ID = 'vendor-spend' as const;
export const VENDOR_RISK_ID = 'vendor-risk' as const;

export type VendorManagementRailItemId =
  | typeof VENDOR_OVERVIEW_ID
  | typeof VENDOR_VENDORS_ID
  | typeof VENDOR_CONTRACTS_ID
  | typeof VENDOR_SPEND_ID
  | typeof VENDOR_RISK_ID;

export const VENDOR_RAIL_PATHS: Record<VendorManagementRailItemId, string> = {
  [VENDOR_OVERVIEW_ID]: '/$workspaceSlug/vendor-management',
  [VENDOR_VENDORS_ID]: '/$workspaceSlug/vendor-management/vendors',
  [VENDOR_CONTRACTS_ID]: '/$workspaceSlug/vendor-management/contracts',
  [VENDOR_SPEND_ID]: '/$workspaceSlug/vendor-management/spend',
  [VENDOR_RISK_ID]: '/$workspaceSlug/vendor-management/risk'
};

export const VENDOR_SECTION_LABELS: Record<VendorManagementRailItemId, string> = {
  [VENDOR_OVERVIEW_ID]: 'Overview',
  [VENDOR_VENDORS_ID]: 'Vendors',
  [VENDOR_CONTRACTS_ID]: 'Contracts',
  [VENDOR_SPEND_ID]: 'Spend',
  [VENDOR_RISK_ID]: 'Risk'
};

export const VENDOR_SECTIONS: { id: VendorManagementRailItemId; label: string }[] = [
  VENDOR_OVERVIEW_ID,
  VENDOR_VENDORS_ID,
  VENDOR_CONTRACTS_ID,
  VENDOR_SPEND_ID,
  VENDOR_RISK_ID
].map(id => ({ id, label: VENDOR_SECTION_LABELS[id] }));
