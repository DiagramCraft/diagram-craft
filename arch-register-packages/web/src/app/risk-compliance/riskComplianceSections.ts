/**
 * Risk & Compliance's rail-item ids, routes, and labels — split out from `riskComplianceShell.tsx`
 * so both it and `sections/RiskComplianceSidebar.tsx` can depend on this leaf module without an
 * import cycle (the sidebar is rendered by `riskComplianceShell.tsx`'s `primarySidebar` factories,
 * and also needs the ids/routes to navigate between sections). Mirrors
 * `../vendor-management/vendorManagementSections.ts`.
 */
export const RISK_OVERVIEW_ID = 'risk-compliance-overview' as const;
export const RISK_RISKS_ID = 'risk-compliance-risks' as const;
export const RISK_CONTROLS_ID = 'risk-compliance-controls' as const;
export const RISK_RETENTION_ID = 'risk-compliance-retention' as const;
export const RISK_ASSESSMENTS_ID = 'risk-compliance-assessments' as const;

export type RiskComplianceRailItemId =
  | typeof RISK_OVERVIEW_ID
  | typeof RISK_RISKS_ID
  | typeof RISK_CONTROLS_ID
  | typeof RISK_RETENTION_ID
  | typeof RISK_ASSESSMENTS_ID;

export const RISK_RAIL_PATHS: Record<RiskComplianceRailItemId, string> = {
  [RISK_OVERVIEW_ID]: '/$workspaceSlug/risk-compliance',
  [RISK_RISKS_ID]: '/$workspaceSlug/risk-compliance/risks',
  [RISK_CONTROLS_ID]: '/$workspaceSlug/risk-compliance/controls',
  [RISK_RETENTION_ID]: '/$workspaceSlug/risk-compliance/retention',
  [RISK_ASSESSMENTS_ID]: '/$workspaceSlug/risk-compliance/assessments'
};

export const RISK_SECTION_LABELS: Record<RiskComplianceRailItemId, string> = {
  [RISK_OVERVIEW_ID]: 'Overview',
  [RISK_RISKS_ID]: 'Risks',
  [RISK_CONTROLS_ID]: 'Controls',
  [RISK_RETENTION_ID]: 'Retention',
  [RISK_ASSESSMENTS_ID]: 'Assessments'
};

export const RISK_SECTIONS: { id: RiskComplianceRailItemId; label: string }[] = [
  RISK_OVERVIEW_ID,
  RISK_RISKS_ID,
  RISK_CONTROLS_ID,
  RISK_RETENTION_ID,
  RISK_ASSESSMENTS_ID
].map(id => ({ id, label: RISK_SECTION_LABELS[id] }));
