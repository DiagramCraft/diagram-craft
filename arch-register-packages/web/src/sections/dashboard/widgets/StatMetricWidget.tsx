import { EntityMetric } from '../../markdown/mdx-components/blocks/entity-metric/EntityMetric';
import type { StatMetricWidgetConfig } from '../../markdown/mdx-components/blocks/entity-metric/types';

type Props = {
  config: StatMetricWidgetConfig;
};

export const StatMetricWidget = ({ config }: Props) => (
  <EntityMetric
    metricType={config.metricType}
    schema={config.schema}
    owner={config.owner}
    lifecycle={config.lifecycle}
    label={config.label}
    bare
  />
);
