import { TbChartLine } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityActivityTrendChart } from './EntityActivityTrendChart';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
import { EntityActivityTrendChartDashboardConfigForm } from './EntityActivityTrendChartDashboardConfigForm';
import type { EntityActivityTrendChartProps } from './types';

export const ENTITY_ACTIVITY_TREND_CHART_TYPE = 'entity-activity-trend-chart' as const;

const hasOptionalInteger = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined ||
  (typeof config[key] === 'number' && Number.isInteger(config[key])); /**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: ENTITY_ACTIVITY_TREND_CHART_TYPE,
  category: 'visualizations',
  name: 'Activity trend chart',
  description: 'Recent activity volume over time.',
  dashboardWidget: {
    icon: TbChartLine,
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace'],
    component: createDashboardWidgetAdapter(
      EntityActivityTrendChart,
      (config: EntityActivityTrendChartProps) => ({ lookbackDays: config.lookbackDays })
    ),
    isValidConfig: (config): config is EntityActivityTrendChartProps =>
      hasOptionalInteger(config, 'lookbackDays'),
    createDefaultConfig: () => ({}),
    configForm: EntityActivityTrendChartDashboardConfigForm
  }
});
