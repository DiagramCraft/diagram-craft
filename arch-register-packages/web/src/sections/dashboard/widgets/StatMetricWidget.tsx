import { Metric } from '../../markdown/mdx-components/blocks/metric/Metric';
import type { StatMetricWidgetConfig } from '../../markdown/mdx-components/blocks/metric/types';

type Props = {
  config: StatMetricWidgetConfig;
};

export const StatMetricWidget = ({ config }: Props) => (
  <Metric
    metricType={config.metricType}
    schema={config.schema}
    owner={config.owner}
    lifecycle={config.lifecycle}
    label={config.label}
    showLink={config.showLink}
    bare
  />
);
