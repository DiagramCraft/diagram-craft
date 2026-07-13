import { TbChartDonut } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityChart } from './EntityChart';
import {
  ENTITY_CHART_TYPE,
  EntityChartEditable,
  entityChartMdxRule
} from './EntityChartEditable';
import type { EntityChartSlateElement } from './types';

/**
 * `type` is the wire/MDX attribute name for the chart type; the preview
 * component's own prop is `chartType`. Preserves the pre-existing external
 * (`type`) vs internal (`chartType`) naming split without changing behavior.
 */
export const entityChartSpec = defineMdxComponent<
  EntityChartSlateElement,
  { schema?: string; owner?: string; lifecycle?: string; groupBy?: string; type?: string },
  'block'
>({
  component: EntityChart,
  mode: 'block',
  allowedProps: ['schema', 'owner', 'lifecycle', 'groupBy', 'type'],
  editorSpec: {
    editableComponent: EntityChartEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityChartMdxRule,
    slashCommand: {
      key: 'entity-chart',
      label: 'Entity Chart',
      description: 'Display a live chart of entities by field',
      icon: <TbChartDonut size={14} />,
      keywords: ['entity', 'chart', 'donut', 'bar', 'graph', 'visualize', 'analytics'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
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
});
