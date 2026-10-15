import { TbChartDonut2 } from 'react-icons/tb';
import { noOptionsConfigSchema } from '../../../markdown/mdx-components/configSchema';
import { defineWidget } from '../../../markdown/mdx-components/defineWidget';
import { EntityLifecycleChart } from './EntityLifecycleChart';

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineWidget({
  type: 'entity-lifecycle-chart',
  category: 'visualizations',
  name: 'Lifecycle chart',
  description: 'Breakdown of entities by lifecycle state.',
  icon: TbChartDonut2,
  component: EntityLifecycleChart,
  configSchema: noOptionsConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace']
  }
});
