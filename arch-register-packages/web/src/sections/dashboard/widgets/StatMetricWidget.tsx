import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityMetric } from '../../markdown/mdx-components/blocks/entity-metric/EntityMetric';
import type { StatMetricWidgetConfig } from '../dashboardWidgetConfig';

type Props = {
  widget: DashboardWidget & { type: 'stat-metric'; config: StatMetricWidgetConfig };
};

export const StatMetricWidget = ({ widget }: Props) => (
  <EntityMetric
    metricType={widget.config.metricType}
    schema={widget.config.schema}
    owner={widget.config.owner}
    lifecycle={widget.config.lifecycle}
    label={widget.config.label}
    bare
  />
);
