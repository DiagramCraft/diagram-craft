import { TbChartDonut2 } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityLifecycleChart } from './EntityLifecycleChart';
import { LifecycleChartWidget } from '../../../../dashboard/widgets/LifecycleChartWidget';
import type { EntityLifecycleChartProps, EntityLifecycleChartSlateElement } from './types';

export const ENTITY_LIFECYCLE_CHART_TYPE = 'entity-lifecycle-chart' as const;

/**
 * Dashboard-only analytics widget: no editorSpec, so it never appears in the
 * wiki slash-command menu or MDX round-trip, regardless of `surfaces`.
 */
export const entityLifecycleChartSpec = defineMdxComponent<
  EntityLifecycleChartSlateElement,
  EntityLifecycleChartProps,
  'block'
>({
  component: EntityLifecycleChart,
  mode: 'block',
  allowedProps: [],
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbChartDonut2,
    label: 'Lifecycle chart',
    description: 'Breakdown of entities by lifecycle state.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace'],
    component: LifecycleChartWidget,
    isValidConfig: (_config): _config is Record<string, never> => true,
    createDefaultConfig: () => ({})
  }
});
