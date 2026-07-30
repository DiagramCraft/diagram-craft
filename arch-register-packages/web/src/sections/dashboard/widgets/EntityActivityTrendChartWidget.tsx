import { EntityActivityTrendChart } from '../../markdown/mdx-components/widgets/entity-activity-trend-chart/EntityActivityTrendChart';
import type { EntityActivityTrendChartProps } from '../../markdown/mdx-components/widgets/entity-activity-trend-chart/types';

type Props = {
  config: EntityActivityTrendChartProps;
};

export const EntityActivityTrendChartWidget = ({ config }: Props) => (
  <EntityActivityTrendChart lookbackDays={config.lookbackDays} />
);
