import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { getDashboardWidgetSpec } from '../markdown/mdx-components/mdxRegistry';

export type KnownDashboardWidget = DashboardWidget & { config: Record<string, unknown> };

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
