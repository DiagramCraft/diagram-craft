import { TbChartLine } from 'react-icons/tb';
import { defineComponent } from '../../../markdown/mdx-components/defineComponent';
import { EntityActivityTrendChart } from './EntityActivityTrendChart';
import { EntityActivityTrendChartDashboardConfigForm } from './EntityActivityTrendChartDashboardConfigForm';
import { schemaGuard } from '../../../markdown/mdx-components/configSchema';
import { entityActivityTrendChartPropsSchema } from './types';

export const ENTITY_ACTIVITY_TREND_CHART_TYPE = 'entity-activity-trend-chart' as const;

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: ENTITY_ACTIVITY_TREND_CHART_TYPE,
  category: 'visualizations',
  name: 'Activity trend chart',
  description: 'Recent activity volume over time.',
  icon: TbChartLine,
  component: EntityActivityTrendChart,
  configForm: EntityActivityTrendChartDashboardConfigForm,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace'],
    isValidConfig: schemaGuard(entityActivityTrendChartPropsSchema)
  }
});
