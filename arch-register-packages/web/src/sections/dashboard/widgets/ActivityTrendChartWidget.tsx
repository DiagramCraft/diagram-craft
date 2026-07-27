import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityActivityTrendChart } from '../../markdown/mdx-components/blocks/entity-activity-trend-chart/EntityActivityTrendChart';

type Props = {
  widget: Extract<DashboardWidget, { type: 'activity-trend-chart' }>;
};

export const ActivityTrendChartWidget = ({ widget }: Props) => (
  <EntityActivityTrendChart lookbackDays={widget.lookbackDays} />
);
