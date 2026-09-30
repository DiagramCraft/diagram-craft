import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';

// The generic starter widgets shown on a brand-new, otherwise-empty dashboard. Shared by the
// client's lazy fallback seeding (web's dashboardWidgetDefaults.ts) and the server's
// schema-template seeding (the risk-compliance template's dashboardWidgets), so the two stay in
// sync instead of duplicating the same widget literals.
export const GENERIC_STARTER_DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: 'default-entity-count',
    type: 'Metric',
    config: { metricType: 'entity-count' },
    x: 0,
    y: 0,
    w: 3,
    h: 8
  },
  {
    id: 'default-project-count',
    type: 'Metric',
    config: { metricType: 'project-count' },
    x: 3,
    y: 0,
    w: 3,
    h: 8
  },
  {
    id: 'default-diagram-count',
    type: 'Metric',
    config: { metricType: 'diagram-count' },
    x: 6,
    y: 0,
    w: 3,
    h: 8
  },
  {
    id: 'default-completeness-percent',
    type: 'Metric',
    config: { metricType: 'completeness-percent' },
    x: 9,
    y: 0,
    w: 3,
    h: 8
  }
];
