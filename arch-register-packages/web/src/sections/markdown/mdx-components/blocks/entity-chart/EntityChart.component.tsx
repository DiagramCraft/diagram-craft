import { TbChartDonut } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityChart } from './EntityChart';
import { ENTITY_CHART_TYPE, EntityChartEditable, entityChartMdxRule } from './EntityChartEditable';
import type {} from './types'; /**
 * `type` is the wire/MDX attribute name for the chart type; the preview
 * component's own prop is `chartType`. Preserves the pre-existing external
 * (`type`) vs internal (`chartType`) naming split without changing behavior.
 */
export default defineComponent({
  type: ENTITY_CHART_TYPE,
  category: 'visualizations',
  name: 'Entity chart',
  description:
    'A live chart of entities grouped by a field. Use it to show distribution, e.g. by lifecycle or owner.',
  component: EntityChart,
  icon: TbChartDonut,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['schema', 'owner', 'lifecycle', 'groupBy', 'type'],
    editorSpec: {
      editableComponent: EntityChartEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityChartMdxRule,
      slashCommand: {
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
  }
});
