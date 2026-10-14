import { TbChartLine } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityActivityTrendChart } from './EntityActivityTrendChart';
import { EntityActivityTrendChartDashboardConfigForm } from './EntityActivityTrendChartDashboardConfigForm';
import type { EntityActivityTrendChartProps } from './types';

export const ENTITY_ACTIVITY_TREND_CHART_TYPE = 'entity-activity-trend-chart' as const;

const hasOptionalInteger = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined ||
  (typeof config[key] === 'number' && Number.isInteger(config[key]));

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: ENTITY_ACTIVITY_TREND_CHART_TYPE,
  category: 'visualizations',
  name: 'Activity trend chart',
  description: 'Recent activity volume over time.',
  component: EntityActivityTrendChart,
  configForm: EntityActivityTrendChartDashboardConfigForm,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    icon: TbChartLine,
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace'],
    isValidConfig: (config): config is EntityActivityTrendChartProps =>
      hasOptionalInteger(config, 'lookbackDays')
  }
});
