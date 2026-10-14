import { TbChartDonut2 } from 'react-icons/tb';
import { noOptionsConfigSchema } from '../../../markdown/mdx-components/configSchema';
import { defineComponent } from '../../../markdown/mdx-components/defineComponent';
import { EntityLifecycleChart } from './EntityLifecycleChart';

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: 'entity-lifecycle-chart',
  category: 'visualizations',
  name: 'Lifecycle chart',
  description: 'Breakdown of entities by lifecycle state.',
  icon: TbChartDonut2,
  component: EntityLifecycleChart,
  configSchema: noOptionsConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace']
  }
});
