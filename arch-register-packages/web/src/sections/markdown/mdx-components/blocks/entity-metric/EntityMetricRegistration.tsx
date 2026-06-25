import type React from 'react';
import { TbHash } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityMetric } from './EntityMetric';
import {
  ENTITY_METRIC_TYPE,
  EntityMetricEditable,
  entityMetricMdxRule
} from './EntityMetricEditable';

export const entityMetricSpec = {
  component: EntityMetric as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['schema', 'owner', 'lifecycle', 'label'],
  editorSpec: {
    editableComponent: EntityMetricEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const },
    mdxRule: entityMetricMdxRule,
    slashCommand: {
      key: 'entity-metric',
      label: 'Entity Metric',
      description: 'Display a live count of entities',
      icon: <TbHash size={14} />,
      keywords: ['entity', 'metric', 'count', 'number', 'stat', 'kpi'],
      onSelect: (editor: any, { insertOrReplaceBlock }: any) => {
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
} satisfies MdxComponentSpec;
