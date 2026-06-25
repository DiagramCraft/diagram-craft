import type React from 'react';
import { TbChartDonut } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityChart } from './EntityChart';
import {
  ENTITY_CHART_TYPE,
  EntityChartEditable,
  entityChartMdxRule
} from './EntityChartEditable';

export const entityChartSpec = {
  component: EntityChart as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['schema', 'owner', 'lifecycle', 'groupBy', 'type'],
  editorSpec: {
    editableComponent: EntityChartEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const },
    mdxRule: entityChartMdxRule,
    slashCommand: {
      key: 'entity-chart',
      label: 'Entity Chart',
      description: 'Display a live chart of entities by field',
      icon: <TbChartDonut size={14} />,
      keywords: ['entity', 'chart', 'donut', 'bar', 'graph', 'visualize', 'analytics'],
      onSelect: (editor: any, { insertOrReplaceBlock }: any) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_CHART_TYPE,
          schema: '',
          owner: '',
          lifecycle: '',
          groupBy: 'lifecycle',
          chartType: 'donut',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
