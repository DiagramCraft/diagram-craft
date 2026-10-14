import { TbChartBar, TbHash } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Metric } from './Metric';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
import { METRIC_TYPE, MetricEditable, metricMdxRule } from './MetricEditable';
import { MetricConfigForm } from './MetricConfigForm';
import type { MetricSlateElement, MetricType, StatMetricWidgetConfig } from './types';

const isMetricType = (value: unknown): value is MetricType =>
  value === 'entity-count' ||
  value === 'project-count' ||
  value === 'diagram-count' ||
  value === 'completeness-percent';

const METRIC_TYPE_DEFAULT_LABEL: Record<MetricType, string> = {
  'entity-count': 'Entities',
  'project-count': 'Projects',
  'diagram-count': 'Diagrams',
  'completeness-percent': 'Well documented'
};

export const metricSpec = defineComponent<
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
    icon: TbChartBar,
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project'],
    component: createDashboardWidgetAdapter(Metric, (config: StatMetricWidgetConfig) => ({
      metricType: config.metricType,
      schema: config.schema,
      owner: config.owner,
      lifecycle: config.lifecycle,
      label: config.label,
      showLink: config.showLink
    })),
    isValidConfig: (config): config is StatMetricWidgetConfig =>
      isMetricType(config.metricType) &&
      (config.schema === undefined || typeof config.schema === 'string') &&
      (config.owner === undefined || typeof config.owner === 'string') &&
      (config.lifecycle === undefined || typeof config.lifecycle === 'string') &&
      (config.label === undefined || typeof config.label === 'string') &&
      (config.showLink === undefined || typeof config.showLink === 'boolean'),
    createDefaultConfig: () => ({ metricType: 'entity-count' }),
    getTitle: (config: StatMetricWidgetConfig) => METRIC_TYPE_DEFAULT_LABEL[config.metricType],
    configForm: MetricConfigForm
  },
  mdxComponent: {
    component: Metric,
    mode: 'block',
    allowedProps: ['schema', 'owner', 'lifecycle', 'label', 'metricType', 'showLink'],
    editorSpec: {
      editableComponent: MetricEditable,
      nodeOptions: { isVoid: true },
      mdxRule: metricMdxRule,
      slashCommand: {
        icon: <TbHash size={14} />,
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
