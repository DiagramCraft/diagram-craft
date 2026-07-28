import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { getDashboardWidgetSpec } from '../markdown/mdx-components/mdxRegistry';
import type { StatMetricWidgetConfig } from '../markdown/mdx-components/blocks/entity-metric/types';
import type { SavedViewEmbedWidgetConfig } from '../markdown/mdx-components/blocks/entity-view-embed/types';
import type { EntityTableWidgetConfig } from '../markdown/mdx-components/blocks/entity-table/types';
import type { EntityActivityTrendChartProps as ActivityTrendChartWidgetConfig } from '../markdown/mdx-components/blocks/entity-activity-trend-chart/types';
import type { EntityStaleReportProps as StaleEntityReportWidgetConfig } from '../markdown/mdx-components/blocks/entity-stale-report/types';
import type { ActivityFeedWidgetConfig } from './widgets/ActivityFeedWidget';

export type {
  StatMetricWidgetConfig,
  SavedViewEmbedWidgetConfig,
  EntityTableWidgetConfig,
  ActivityTrendChartWidgetConfig,
  StaleEntityReportWidgetConfig,
  ActivityFeedWidgetConfig
};

export type KnownDashboardWidget =
  | (DashboardWidget & { type: 'EntityMetric'; config: StatMetricWidgetConfig })
  | (DashboardWidget & { type: 'EntityViewEmbed'; config: SavedViewEmbedWidgetConfig })
  | (DashboardWidget & { type: 'EntityTable'; config: EntityTableWidgetConfig })
  | (DashboardWidget & { type: 'entity-lifecycle-chart' })
  | (DashboardWidget & {
      type: 'entity-activity-trend-chart';
      config: ActivityTrendChartWidgetConfig;
    })
  | (DashboardWidget & { type: 'entity-stale-report'; config: StaleEntityReportWidgetConfig })
  | (DashboardWidget & { type: 'activity-feed'; config: ActivityFeedWidgetConfig })
  | (DashboardWidget & { type: 'active-assessments' })
  | (DashboardWidget & { type: 'upcoming-milestones' });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseKnownDashboardWidget = (widget: DashboardWidget): KnownDashboardWidget | null => {
  const dashboardWidget = getDashboardWidgetSpec(widget.type);
  if (
    !dashboardWidget ||
    !isRecord(widget.config) ||
    !dashboardWidget.isValidConfig(widget.config)
  ) {
    return null;
  }
  return widget as KnownDashboardWidget;
};
