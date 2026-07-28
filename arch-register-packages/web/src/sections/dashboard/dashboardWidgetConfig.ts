import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { EntityMetricType } from '../markdown/mdx-components/blocks/entity-metric/types';

export const KNOWN_WIDGET_TYPES = [
  'stat-metric',
  'saved-view-embed',
  'entity-table',
  'lifecycle-chart',
  'activity-trend-chart',
  'stale-entity-report',
  'activity-feed',
  'active-assessments',
  'upcoming-milestones'
] as const;

export type KnownWidgetType = (typeof KNOWN_WIDGET_TYPES)[number];

type WidgetConfig = Record<string, unknown>;

export type StatMetricWidgetConfig = WidgetConfig & {
  metricType: EntityMetricType;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
};

export type SavedViewEmbedWidgetConfig = WidgetConfig & { viewId: string };

export type EntityTableWidgetConfig = WidgetConfig & {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: number;
};

export type ActivityTrendChartWidgetConfig = WidgetConfig & { lookbackDays?: number };
export type StaleEntityReportWidgetConfig = WidgetConfig & { staleAfterDays?: number };
export type ActivityFeedWidgetConfig = WidgetConfig & { limit?: number };

export type KnownDashboardWidget =
  | (DashboardWidget & { type: 'stat-metric'; config: StatMetricWidgetConfig })
  | (DashboardWidget & { type: 'saved-view-embed'; config: SavedViewEmbedWidgetConfig })
  | (DashboardWidget & { type: 'entity-table'; config: EntityTableWidgetConfig })
  | (DashboardWidget & { type: 'lifecycle-chart' })
  | (DashboardWidget & {
      type: 'activity-trend-chart';
      config: ActivityTrendChartWidgetConfig;
    })
  | (DashboardWidget & { type: 'stale-entity-report'; config: StaleEntityReportWidgetConfig })
  | (DashboardWidget & { type: 'activity-feed'; config: ActivityFeedWidgetConfig })
  | (DashboardWidget & { type: 'active-assessments' })
  | (DashboardWidget & { type: 'upcoming-milestones' });

const isRecord = (value: unknown): value is WidgetConfig =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOptionalString = (config: WidgetConfig, key: string): boolean =>
  config[key] === undefined || typeof config[key] === 'string';

const hasOptionalInteger = (config: WidgetConfig, key: string): boolean =>
  config[key] === undefined || (typeof config[key] === 'number' && Number.isInteger(config[key]));

const isMetricType = (value: unknown): value is EntityMetricType =>
  value === 'entity-count' ||
  value === 'project-count' ||
  value === 'diagram-count' ||
  value === 'completeness-percent';

const isStatMetricConfig = (config: WidgetConfig): config is StatMetricWidgetConfig =>
  isMetricType(config.metricType) &&
  hasOptionalString(config, 'schema') &&
  hasOptionalString(config, 'owner') &&
  hasOptionalString(config, 'lifecycle') &&
  hasOptionalString(config, 'label');

const isSavedViewEmbedConfig = (config: WidgetConfig): config is SavedViewEmbedWidgetConfig =>
  typeof config.viewId === 'string';

const isEntityTableConfig = (config: WidgetConfig): config is EntityTableWidgetConfig =>
  hasOptionalString(config, 'schema') &&
  hasOptionalString(config, 'owner') &&
  hasOptionalString(config, 'lifecycle') &&
  hasOptionalInteger(config, 'limit');

const isActivityTrendChartConfig = (
  config: WidgetConfig
): config is ActivityTrendChartWidgetConfig => hasOptionalInteger(config, 'lookbackDays');

const isStaleEntityReportConfig = (config: WidgetConfig): config is StaleEntityReportWidgetConfig =>
  hasOptionalInteger(config, 'staleAfterDays');

const isActivityFeedConfig = (config: WidgetConfig): config is ActivityFeedWidgetConfig =>
  hasOptionalInteger(config, 'limit');

export const parseKnownDashboardWidget = (widget: DashboardWidget): KnownDashboardWidget | null => {
  if (!isRecord(widget.config)) return null;

  switch (widget.type) {
    case 'stat-metric':
      return isStatMetricConfig(widget.config)
        ? { ...widget, type: 'stat-metric', config: widget.config }
        : null;
    case 'saved-view-embed':
      return isSavedViewEmbedConfig(widget.config)
        ? { ...widget, type: 'saved-view-embed', config: widget.config }
        : null;
    case 'entity-table':
      return isEntityTableConfig(widget.config)
        ? { ...widget, type: 'entity-table', config: widget.config }
        : null;
    case 'lifecycle-chart':
      return { ...widget, type: 'lifecycle-chart' };
    case 'activity-trend-chart':
      return isActivityTrendChartConfig(widget.config)
        ? { ...widget, type: 'activity-trend-chart', config: widget.config }
        : null;
    case 'stale-entity-report':
      return isStaleEntityReportConfig(widget.config)
        ? { ...widget, type: 'stale-entity-report', config: widget.config }
        : null;
    case 'activity-feed':
      return isActivityFeedConfig(widget.config)
        ? { ...widget, type: 'activity-feed', config: widget.config }
        : null;
    case 'active-assessments':
      return { ...widget, type: 'active-assessments' };
    case 'upcoming-milestones':
      return { ...widget, type: 'upcoming-milestones' };
    default:
      return null;
  }
};

export const isKnownWidgetType = (type: string): type is KnownWidgetType =>
  (KNOWN_WIDGET_TYPES as readonly string[]).includes(type);
