import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityActivityTrendChart } from '../../markdown/mdx-components/blocks/entity-activity-trend-chart/EntityActivityTrendChart';
import type { ActivityTrendChartWidgetConfig } from '../dashboardWidgetConfig';

type Props = {
  widget: DashboardWidget & {
    type: 'activity-trend-chart';
    config: ActivityTrendChartWidgetConfig;
  };
};

export const ActivityTrendChartWidget = ({ widget }: Props) => (
  <EntityActivityTrendChart lookbackDays={widget.config.lookbackDays} />
);
