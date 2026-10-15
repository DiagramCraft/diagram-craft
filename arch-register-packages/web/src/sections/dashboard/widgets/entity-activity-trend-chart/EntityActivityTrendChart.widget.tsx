import { TbChartLine } from 'react-icons/tb';
import { defineWidget } from '../../../markdown/mdx-components/defineWidget';
import { EntityActivityTrendChart } from './EntityActivityTrendChart';
import { EntityActivityTrendChartDashboardConfigForm } from './EntityActivityTrendChartDashboardConfigForm';
import { entityActivityTrendChartPropsSchema } from './types';

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineWidget({
  type: 'entity-activity-trend-chart',
  category: 'visualizations',
  name: 'Activity trend chart',
  description: 'Recent activity volume over time.',
  icon: TbChartLine,
  component: EntityActivityTrendChart,
  configForm: EntityActivityTrendChartDashboardConfigForm,
  configSchema: entityActivityTrendChartPropsSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace']
  }
});
