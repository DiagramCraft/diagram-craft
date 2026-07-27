import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityActivityTrendChart } from './EntityActivityTrendChart';
import type { EntityActivityTrendChartProps, EntityActivityTrendChartSlateElement } from './types';

export const ENTITY_ACTIVITY_TREND_CHART_TYPE = 'entity-activity-trend-chart' as const;

/**
 * Dashboard-only analytics widget: no editorSpec, so it never appears in the
 * wiki slash-command menu or MDX round-trip, regardless of `surfaces`.
 */
export const entityActivityTrendChartSpec = defineMdxComponent<
  EntityActivityTrendChartSlateElement,
  EntityActivityTrendChartProps,
  'block'
>({
  component: EntityActivityTrendChart,
  mode: 'block',
  allowedProps: ['lookbackDays'],
  surfaces: ['dashboard']
});
