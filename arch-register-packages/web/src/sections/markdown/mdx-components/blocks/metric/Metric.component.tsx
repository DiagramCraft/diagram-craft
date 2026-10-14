import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Metric } from './Metric';
import { METRIC_TYPE, MetricEditable, metricMdxRule } from './MetricEditable';
import { MetricConfigForm } from './MetricConfigForm';
import { schemaGuard } from '../../configSchema';
import {
  metricTypeSchema,
  statMetricWidgetConfigSchema,
  type MetricSlateElement,
  type MetricType,
  type StatMetricWidgetConfig
} from './types';

const isMetricType = (value: unknown): value is MetricType =>
  metricTypeSchema.safeParse(value).success;

const METRIC_TYPE_DEFAULT_LABEL: Record<MetricType, string> = {
  'entity-count': 'Entities',
  'project-count': 'Projects',
  'diagram-count': 'Diagrams',
  'completeness-percent': 'Well documented'
};
export default defineComponent<
  MetricSlateElement,
  {
    schema?: string;
    owner?: string;
    lifecycle?: string;
    label?: string;
    metricType?: MetricType;
    showLink?: boolean;
  },
  'block'
>({
  type: METRIC_TYPE,
  category: 'metrics',
  name: 'Metric',
  description:
    'A single live count, such as the number of entities, projects or diagrams. Use it for a headline number.',
  dashboardWidget: {
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project'],
    isValidConfig: schemaGuard(statMetricWidgetConfigSchema),
    getTitle: (config: StatMetricWidgetConfig) => METRIC_TYPE_DEFAULT_LABEL[config.metricType]
  },
  component: Metric,
  createDefaultProps: () => ({ config: { metricType: 'entity-count' } }),
  configForm: MetricConfigForm,
  icon: TbChartBar,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['schema', 'owner', 'lifecycle', 'label', 'metricType', 'showLink'],
    mapProps: props => ({
      config: {
        schema: props.schema,
        owner: props.owner,
        lifecycle: props.lifecycle,
        label: props.label,
        metricType: isMetricType(props.metricType) ? props.metricType : 'entity-count',
        showLink: props.showLink === undefined ? true : props.showLink !== 'false'
      }
    }),
    editorSpec: {
      editableComponent: MetricEditable,
      nodeOptions: { isVoid: true },
      mdxRule: metricMdxRule,
      slashCommand: {
        keywords: ['entity', 'metric', 'count', 'number', 'stat', 'kpi'],
        onSelect: (editor, { insertOrReplaceBlock }) => {
          insertOrReplaceBlock(editor, {
            type: METRIC_TYPE,
            schema: '',
            owner: '',
            lifecycle: '',
            label: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
