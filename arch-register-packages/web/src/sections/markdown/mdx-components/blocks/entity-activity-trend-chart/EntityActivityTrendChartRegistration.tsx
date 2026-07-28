import { TbChartLine } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityActivityTrendChart } from './EntityActivityTrendChart';
import { ActivityTrendChartWidget } from '../../../../dashboard/widgets/ActivityTrendChartWidget';
import type { EntityActivityTrendChartProps, EntityActivityTrendChartSlateElement } from './types';

export const ENTITY_ACTIVITY_TREND_CHART_TYPE = 'entity-activity-trend-chart' as const;

const hasOptionalInteger = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || (typeof config[key] === 'number' && Number.isInteger(config[key]));

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
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbChartLine,
    label: 'Activity trend chart',
    description: 'Recent activity volume over time.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace'],
    component: ActivityTrendChartWidget,
    isValidConfig: (config): config is EntityActivityTrendChartProps =>
      hasOptionalInteger(config, 'lookbackDays'),
    createDefaultConfig: () => ({})
  }
});
