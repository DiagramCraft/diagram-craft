import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import './dashboardWidgetRegistry';
import { getComponentDefinition } from '../markdown/mdx-components/componentRegistry';

export type KnownDashboardWidget = DashboardWidget & { config: Record<string, unknown> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseKnownDashboardWidget = (widget: DashboardWidget): KnownDashboardWidget | null => {
  const dashboardWidget = getComponentDefinition(widget.type, 'dashboardWidget')?.dashboardWidget;
  if (
    !dashboardWidget ||
    !isRecord(widget.config) ||
    !dashboardWidget.isValidConfig(widget.config)
  ) {
    return null;
  }
  return widget as KnownDashboardWidget;
};
