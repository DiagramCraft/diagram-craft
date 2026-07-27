import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityMetric } from '../../markdown/mdx-components/blocks/entity-metric/EntityMetric';

type Props = {
  widget: Extract<DashboardWidget, { type: 'stat-metric' }>;
};

export const StatMetricWidget = ({ widget }: Props) => (
  <EntityMetric
    metricType={widget.metricType}
    schema={widget.schema}
    owner={widget.owner}
    lifecycle={widget.lifecycle}
    label={widget.label}
    bare
  />
);
