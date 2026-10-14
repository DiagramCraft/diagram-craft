import { TbChartLine } from 'react-icons/tb';
import { defineComponent } from '../../../markdown/mdx-components/defineComponent';
import { EntityActivityTrendChart } from './EntityActivityTrendChart';
import { EntityActivityTrendChartDashboardConfigForm } from './EntityActivityTrendChartDashboardConfigForm';
import { entityActivityTrendChartPropsSchema } from './types';

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: 'entity-activity-trend-chart',
  category: 'visualizations',
  name: 'Activity trend chart',
  description: 'Recent activity volume over time.',
  icon: TbChartLine,
  component: EntityActivityTrendChart,
  configForm: EntityActivityTrendChartDashboardConfigForm,
  configSchema: entityActivityTrendChartPropsSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace']
  }
});
