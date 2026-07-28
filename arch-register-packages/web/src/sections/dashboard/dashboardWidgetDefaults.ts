import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { getDashboardWidgetSpec } from '../markdown/mdx-components/mdxRegistry';
import type { KnownWidgetType } from '../markdown/mdx-components/mdxRegistry';
import type { KnownDashboardWidget } from './dashboardWidgetConfig';

export type { WidgetSurface } from '../markdown/mdx-components/types';

export const getWidgetTitle = (widget: KnownDashboardWidget): string => {
  const dashboardWidget = getDashboardWidgetSpec(widget.type);
  if (!dashboardWidget) return 'Widget';
  return dashboardWidget.getTitle?.(widget.config) ?? dashboardWidget.label;
};

const nextRowY = (widgets: DashboardWidget[]): number =>
  widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);

export const createDefaultWidget = (
  type: KnownWidgetType,
  widgets: DashboardWidget[],
  viewId?: string
): DashboardWidget => {
  const dashboardWidget = getDashboardWidgetSpec(type)!;
  const id = `widget-${crypto.randomUUID()}`;
  return {
    id,
    x: 0,
    y: nextRowY(widgets),
    w: dashboardWidget.defaultW,
    h: dashboardWidget.defaultH,
    type,
    config: dashboardWidget.createDefaultConfig({ viewId })
  };
};

export const DEFAULT_SEEDED_WIDGETS: DashboardWidget[] = [
  {
    id: 'default-entity-count',
    type: 'EntityMetric',
    config: { metricType: 'entity-count' },
    x: 0,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-project-count',
    type: 'EntityMetric',
    config: { metricType: 'project-count' },
    x: 3,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-diagram-count',
    type: 'EntityMetric',
    config: { metricType: 'diagram-count' },
    x: 6,
    y: 0,
    w: 3,
    h: 2
  },
  {
    id: 'default-completeness-percent',
    type: 'EntityMetric',
    config: { metricType: 'completeness-percent' },
    x: 9,
    y: 0,
    w: 3,
    h: 2
  },
  { id: 'default-activity-feed', type: 'activity-feed', config: {}, x: 0, y: 2, w: 12, h: 6 }
];
