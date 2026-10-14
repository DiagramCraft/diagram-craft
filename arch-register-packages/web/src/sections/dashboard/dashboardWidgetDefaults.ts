import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { GENERIC_STARTER_DASHBOARD_WIDGETS } from '@arch-register/api-types/dashboardWidgetSeeds';
import './dashboardWidgetRegistry';
import { getComponentDefinition } from '../markdown/mdx-components/componentRegistry';
import type { KnownDashboardWidget } from './dashboardWidgetConfig';

export type { WidgetSurface } from '../markdown/mdx-components/types';

export const getWidgetTitle = (widget: KnownDashboardWidget): string => {
  const dashboardWidget = getComponentDefinition(widget.type, 'dashboardWidget')?.dashboardWidget;
  if (!dashboardWidget) return 'Widget';
  return dashboardWidget.getTitle?.(widget.config) ?? dashboardWidget.label;
};

const nextRowY = (widgets: DashboardWidget[]): number =>
  widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);

export const createDefaultWidget = (
  type: string,
  widgets: DashboardWidget[],
  viewId?: string
): DashboardWidget => {
  const definition = getComponentDefinition(type, 'dashboardWidget')!;
  const dashboardWidget = definition.dashboardWidget;
  const id = `widget-${crypto.randomUUID()}`;
  return {
    id,
    x: 0,
    y: nextRowY(widgets),
    w: dashboardWidget.defaultW,
    h: dashboardWidget.defaultH,
    type,
    config: definition.createDefaultConfig({ viewId }) as DashboardWidget['config']
  };
};

export const DEFAULT_SEEDED_WIDGETS: DashboardWidget[] = [
  ...GENERIC_STARTER_DASHBOARD_WIDGETS,
  { id: 'default-activity-feed', type: 'activity-feed', config: {}, x: 0, y: 8, w: 12, h: 24 }
];
