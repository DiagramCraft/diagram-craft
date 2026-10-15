import '../../widgetDiscovery';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { GENERIC_STARTER_DASHBOARD_WIDGETS } from '@arch-register/api-types/dashboardWidgetSeeds';
import {
  createDefaultConfig,
  getWidgetDefinition,
  isValidComponentConfig
} from '../../widgets/shared/widgetRegistry';

export type KnownDashboardWidget = DashboardWidget & { config: Record<string, unknown> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseKnownDashboardWidget = (widget: DashboardWidget): KnownDashboardWidget | null => {
  const definition = getWidgetDefinition(widget.type, 'dashboard');
  if (
    !definition ||
    !isRecord(widget.config) ||
    !isValidComponentConfig(definition, widget.config)
  ) {
    return null;
  }
  return widget as KnownDashboardWidget;
};

export const getWidgetTitle = (widget: KnownDashboardWidget): string => {
  const definition = getWidgetDefinition(widget.type, 'dashboard');
  if (!definition) return 'Widget';
  return definition.dashboard.getTitle?.(widget.config) ?? definition.name;
};

const nextRowY = (widgets: DashboardWidget[]): number =>
  widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);

export const createDefaultWidget = (
  type: string,
  widgets: DashboardWidget[],
  viewId?: string
): DashboardWidget => {
  const definition = getWidgetDefinition(type, 'dashboard')!;
  const dashboardWidget = definition.dashboard;
  const id = `widget-${crypto.randomUUID()}`;
  return {
    id,
    x: 0,
    y: nextRowY(widgets),
    w: dashboardWidget.defaultW,
    h: dashboardWidget.defaultH,
    type,
    config: createDefaultConfig(definition, { viewId }) as DashboardWidget['config']
  };
};

export const DEFAULT_SEEDED_WIDGETS: DashboardWidget[] = [
  ...GENERIC_STARTER_DASHBOARD_WIDGETS,
  { id: 'default-activity-feed', type: 'activity-feed', config: {}, x: 0, y: 8, w: 12, h: 24 }
];
