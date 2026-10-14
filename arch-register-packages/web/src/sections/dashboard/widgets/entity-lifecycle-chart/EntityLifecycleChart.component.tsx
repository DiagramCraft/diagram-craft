import { TbChartDonut2 } from 'react-icons/tb';
import { noOptionsConfigSchema, schemaGuard } from '../../../markdown/mdx-components/configSchema';
import { defineComponent } from '../../../markdown/mdx-components/defineComponent';
import { EntityLifecycleChart } from './EntityLifecycleChart';

export const ENTITY_LIFECYCLE_CHART_TYPE = 'entity-lifecycle-chart' as const;

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: ENTITY_LIFECYCLE_CHART_TYPE,
  category: 'visualizations',
  name: 'Lifecycle chart',
  description: 'Breakdown of entities by lifecycle state.',
  icon: TbChartDonut2,
  component: EntityLifecycleChart,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace'],
    isValidConfig: schemaGuard(noOptionsConfigSchema)
  }
});
