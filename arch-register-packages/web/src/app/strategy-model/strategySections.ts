/**
 * Strategy & Capability Modelling's rail-item ids, routes, and labels — split out from
 * `strategyShell.tsx` so both it and `sections/StrategySidebar.tsx` can depend on this leaf
 * module without an import cycle (the sidebar is rendered by `strategyShell.tsx`'s
 * `primarySidebar` factories, and also needs the ids/routes to navigate between sections).
 */
export const STRATEGY_CAPABILITY_MAP_ID = 'strategy-capability-map' as const;
export const STRATEGY_CAPABILITIES_ID = 'strategy-capabilities' as const;
export const STRATEGY_HEATMAPS_ID = 'strategy-heatmaps' as const;
export const STRATEGY_STRATEGY_ID = 'strategy-strategy' as const;
export const STRATEGY_TRACEABILITY_ID = 'strategy-traceability' as const;

export type StrategyRailItemId =
  | typeof STRATEGY_CAPABILITY_MAP_ID
  | typeof STRATEGY_CAPABILITIES_ID
  | typeof STRATEGY_HEATMAPS_ID
  | typeof STRATEGY_STRATEGY_ID
  | typeof STRATEGY_TRACEABILITY_ID;

export const STRATEGY_RAIL_PATHS: Record<StrategyRailItemId, string> = {
  [STRATEGY_CAPABILITY_MAP_ID]: '/$workspaceSlug/strategy/map',
  [STRATEGY_CAPABILITIES_ID]: '/$workspaceSlug/strategy/capabilities',
  [STRATEGY_HEATMAPS_ID]: '/$workspaceSlug/strategy/heatmaps',
  [STRATEGY_STRATEGY_ID]: '/$workspaceSlug/strategy/strategy',
  [STRATEGY_TRACEABILITY_ID]: '/$workspaceSlug/strategy/traceability'
};

export const STRATEGY_SECTION_LABELS: Record<StrategyRailItemId, string> = {
  [STRATEGY_CAPABILITY_MAP_ID]: 'Capability map',
  [STRATEGY_CAPABILITIES_ID]: 'Capabilities',
  [STRATEGY_HEATMAPS_ID]: 'Heatmaps',
  [STRATEGY_STRATEGY_ID]: 'Strategy',
  [STRATEGY_TRACEABILITY_ID]: 'Traceability'
};

// `STRATEGY_HEATMAPS_ID` is intentionally omitted — the Heatmaps section (#3193) is
// deprioritized, so it is kept out of the rail and the section nav list. Its id, route
// path, and label are retained above so the route still resolves and it can be re-added.
export const STRATEGY_SECTIONS: { id: StrategyRailItemId; label: string }[] = [
  STRATEGY_CAPABILITY_MAP_ID,
  STRATEGY_CAPABILITIES_ID,
  STRATEGY_STRATEGY_ID,
  STRATEGY_TRACEABILITY_ID
].map(id => ({ id, label: STRATEGY_SECTION_LABELS[id] }));
