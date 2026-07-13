import { TbHash } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityMetric } from './EntityMetric';
import {
  ENTITY_METRIC_TYPE,
  EntityMetricEditable,
  entityMetricMdxRule
} from './EntityMetricEditable';
import type { EntityMetricSlateElement } from './types';

export const entityMetricSpec = defineMdxComponent<
  EntityMetricSlateElement,
  { schema?: string; owner?: string; lifecycle?: string; label?: string },
  'block'
>({
  component: EntityMetric,
  mode: 'block',
  allowedProps: ['schema', 'owner', 'lifecycle', 'label'],
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
