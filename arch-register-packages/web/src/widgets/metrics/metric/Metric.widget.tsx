import { TbChartBar } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { flatConfigCodec } from '../../shared/configSchema';
import { configBlockMdx } from '../../shared/mdx/configBlock';
import { Metric } from './Metric';
import { MetricConfigForm } from './MetricConfigForm';
import {
  statMetricWidgetConfigSchema,
  type MetricType,
  type StatMetricWidgetConfig
} from './types';

const METRIC_TYPE_DEFAULT_LABEL: Record<MetricType, string> = {
  'entity-count': 'Entities',
  'project-count': 'Projects',
  'diagram-count': 'Diagrams',
  'completeness-percent': 'Well documented'
};

export default defineWidget({
  type: 'Metric',
  category: 'metrics',
  name: 'Metric',
  description:
    'A single live count, such as the number of entities, projects or diagrams. Use it for a headline number.',
  configSchema: statMetricWidgetConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project'],
    getTitle: (config: StatMetricWidgetConfig) => METRIC_TYPE_DEFAULT_LABEL[config.metricType]
  },
  keywords: ['entity', 'metric', 'count', 'number', 'stat', 'kpi'],
  component: Metric,
  configForm: MetricConfigForm,
  icon: TbChartBar,
  mdx: configBlockMdx({
    codec: flatConfigCodec(statMetricWidgetConfigSchema),
    placeholder: 'Configure metric…'
  })
});
