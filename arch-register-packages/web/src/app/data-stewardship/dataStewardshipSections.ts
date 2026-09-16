/**
 * Data Stewardship's rail-item ids, routes, and labels — split out from `dataStewardshipShell.tsx`
 * so both it and `sections/DataStewardshipSidebar.tsx` can depend on this leaf module without an
 * import cycle (the sidebar is rendered by `dataStewardshipShell.tsx`'s `primarySidebar` factories,
 * and also needs the ids/routes to navigate between sections). Mirrors
 * `../risk-compliance/riskComplianceSections.ts`.
 *
 * Unlike Risk & Compliance / Vendor Management, there is no separate Overview section — "My work"
 * is `sections[0]` and doubles as the landing screen (per #3152).
 */
export const DS_MY_WORK_ID = 'data-stewardship-my-work' as const;
export const DS_STEWARDSHIP_ID = 'data-stewardship-stewardship' as const;
export const DS_CLASSIFICATION_ID = 'data-stewardship-classification' as const;
export const DS_CHANGE_CASES_ID = 'data-stewardship-change-cases' as const;
export const DS_ASSESSMENTS_ID = 'data-stewardship-assessments' as const;

export type DataStewardshipRailItemId =
  | typeof DS_MY_WORK_ID
  | typeof DS_STEWARDSHIP_ID
  | typeof DS_CLASSIFICATION_ID
  | typeof DS_CHANGE_CASES_ID
  | typeof DS_ASSESSMENTS_ID;

export const DS_RAIL_PATHS: Record<DataStewardshipRailItemId, string> = {
  [DS_MY_WORK_ID]: '/$workspaceSlug/data-stewardship',
  [DS_STEWARDSHIP_ID]: '/$workspaceSlug/data-stewardship/stewardship',
  [DS_CLASSIFICATION_ID]: '/$workspaceSlug/data-stewardship/classification',
  [DS_CHANGE_CASES_ID]: '/$workspaceSlug/data-stewardship/change-cases',
  [DS_ASSESSMENTS_ID]: '/$workspaceSlug/data-stewardship/assessments'
};

export const DS_SECTION_LABELS: Record<DataStewardshipRailItemId, string> = {
  [DS_MY_WORK_ID]: 'My work',
  [DS_STEWARDSHIP_ID]: 'Stewardship',
  [DS_CLASSIFICATION_ID]: 'Classification',
  [DS_CHANGE_CASES_ID]: 'Change cases & exceptions',
  [DS_ASSESSMENTS_ID]: 'Assessments'
};

export const DS_SECTIONS: { id: DataStewardshipRailItemId; label: string }[] = [
  DS_MY_WORK_ID,
  DS_STEWARDSHIP_ID,
  DS_CLASSIFICATION_ID,
  DS_CHANGE_CASES_ID,
  DS_ASSESSMENTS_ID
].map(id => ({ id, label: DS_SECTION_LABELS[id] }));
