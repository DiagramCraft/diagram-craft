import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';

export const API_INTEGRATION_CATALOG_APP_KEY = 'api-integration-catalog';

export type AppDashboardSeed = {
  name: string;
  description: string;
  widgets: DashboardWidget[];
};

export const APP_DASHBOARD_SEEDS: Record<string, AppDashboardSeed> = {
  [API_INTEGRATION_CATALOG_APP_KEY]: {
    name: 'Overview',
    description: 'API specifications, operations and integration relations at a glance.',
    widgets: [
      {
        id: 'seed-stats',
        type: 'api-integration-catalog-stats',
        config: {},
        x: 0,
        y: 0,
        w: 12,
        h: 5
      },
      {
        id: 'seed-needs-attention',
        type: 'api-integration-catalog-needs-attention',
        config: { limit: 8 },
        x: 0,
        y: 5,
        w: 6,
        h: 20
      },
      {
        id: 'seed-most-consumed',
        type: 'api-integration-catalog-most-consumed',
        config: { limit: 6 },
        x: 6,
        y: 5,
        w: 6,
        h: 20
      },
      {
        id: 'seed-at-risk',
        type: 'api-integration-catalog-at-risk',
        config: { limit: 8 },
        x: 0,
        y: 25,
        w: 12,
        h: 20
      }
    ]
  }
};
