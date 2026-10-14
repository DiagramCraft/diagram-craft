import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { flatConfigCodec } from '../../configSchema';
import { configBlockMdx } from '../configBlock';
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

export default defineComponent({
  type: 'Metric',
  category: 'metrics',
  name: 'Metric',
  description:
    'A single live count, such as the number of entities, projects or diagrams. Use it for a headline number.',
  configSchema: statMetricWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project'],
    getTitle: (config: StatMetricWidgetConfig) => METRIC_TYPE_DEFAULT_LABEL[config.metricType]
  },
  component: Metric,
  configForm: MetricConfigForm,
  icon: TbChartBar,
  mdxComponent: configBlockMdx({
    type: 'Metric',
    codec: flatConfigCodec(statMetricWidgetConfigSchema),
    placeholder: 'Configure metric…',
    keywords: ['entity', 'metric', 'count', 'number', 'stat', 'kpi']
  })
});
