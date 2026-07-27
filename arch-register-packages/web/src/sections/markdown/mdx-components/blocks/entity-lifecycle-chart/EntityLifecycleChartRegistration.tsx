import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityLifecycleChart } from './EntityLifecycleChart';
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
  surfaces: ['dashboard']
});
