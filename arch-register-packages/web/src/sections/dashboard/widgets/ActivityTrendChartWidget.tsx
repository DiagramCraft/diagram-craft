import { EntityActivityTrendChart } from '../../markdown/mdx-components/blocks/entity-activity-trend-chart/EntityActivityTrendChart';
import type { EntityActivityTrendChartProps } from '../../markdown/mdx-components/blocks/entity-activity-trend-chart/types';

type Props = {
  config: EntityActivityTrendChartProps;
};

export const ActivityTrendChartWidget = ({ config }: Props) => (
  <EntityActivityTrendChart lookbackDays={config.lookbackDays} />
);
