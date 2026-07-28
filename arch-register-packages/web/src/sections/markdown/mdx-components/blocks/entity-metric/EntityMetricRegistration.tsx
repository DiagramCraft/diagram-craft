import { TbChartBar, TbHash } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityMetric } from './EntityMetric';
import { StatMetricWidget } from '../../../../dashboard/widgets/StatMetricWidget';
import {
  ENTITY_METRIC_TYPE,
  EntityMetricEditable,
  entityMetricMdxRule
} from './EntityMetricEditable';
import type { EntityMetricSlateElement, EntityMetricType, StatMetricWidgetConfig } from './types';

const isMetricType = (value: unknown): value is EntityMetricType =>
  value === 'entity-count' ||
  value === 'project-count' ||
  value === 'diagram-count' ||
  value === 'completeness-percent';

const METRIC_TYPE_DEFAULT_LABEL: Record<EntityMetricType, string> = {
  'entity-count': 'Entities',
  'project-count': 'Projects',
  'diagram-count': 'Diagrams',
  'completeness-percent': 'Well documented'
};

export const entityMetricSpec = defineMdxComponent<
  EntityMetricSlateElement,
  {
    schema?: string;
    owner?: string;
    lifecycle?: string;
    label?: string;
    metricType?: EntityMetricType;
  },
  'block'
>({
  component: EntityMetric,
  mode: 'block',
  allowedProps: ['schema', 'owner', 'lifecycle', 'label', 'metricType'],
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbChartBar,
    label: 'Stat metric',
    description: 'A single number, such as entity count or completeness percentage.',
    defaultW: 3,
    defaultH: 2,
    surfaces: ['workspace', 'project'],
    component: StatMetricWidget,
    isValidConfig: (config): config is StatMetricWidgetConfig =>
      isMetricType(config.metricType) &&
      (config.schema === undefined || typeof config.schema === 'string') &&
      (config.owner === undefined || typeof config.owner === 'string') &&
      (config.lifecycle === undefined || typeof config.lifecycle === 'string') &&
      (config.label === undefined || typeof config.label === 'string'),
    createDefaultConfig: () => ({ metricType: 'entity-count' }),
    getTitle: (config: StatMetricWidgetConfig) =>
      config.label?.trim() || METRIC_TYPE_DEFAULT_LABEL[config.metricType]
  },
  editorSpec: {
    editableComponent: EntityMetricEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityMetricMdxRule,
    slashCommand: {
      key: 'entity-metric',
      label: 'Entity Metric',
      description: 'Display a live count of entities',
      icon: <TbHash size={14} />,
      keywords: ['entity', 'metric', 'count', 'number', 'stat', 'kpi'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_METRIC_TYPE,
          schema: '',
          owner: '',
          lifecycle: '',
          label: '',
          children: [{ text: '' }]
        });
      }
    }
  }
});
