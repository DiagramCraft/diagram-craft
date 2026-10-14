import { TbChartDonut2 } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityLifecycleChartWidget } from '../../../../dashboard/widgets/EntityLifecycleChartWidget';

export const ENTITY_LIFECYCLE_CHART_TYPE = 'entity-lifecycle-chart' as const; /**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: ENTITY_LIFECYCLE_CHART_TYPE,
  category: 'visualizations',
  name: 'Lifecycle chart',
  description: 'Breakdown of entities by lifecycle state.',
  dashboardWidget: {
    icon: TbChartDonut2,
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace'],
    component: EntityLifecycleChartWidget,
    isValidConfig: (_config): _config is Record<string, never> => true,
    createDefaultConfig: () => ({})
  }
});
