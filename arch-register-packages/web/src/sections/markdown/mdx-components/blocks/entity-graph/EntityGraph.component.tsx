import { TbVectorTriangle } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityGraph } from './EntityGraph';
import { ENTITY_GRAPH_TYPE, EntityGraphEditable, entityGraphMdxRule } from './EntityGraphEditable';
import { EntityGraphConfigForm } from './EntityGraphConfigForm';
import {
  normalizeEntityGraphDepth,
  normalizeEntityGraphDirection,
  normalizeEntityGraphProps,
  entityGraphWidgetConfigSchema
} from './types';
export default defineComponent({
  type: ENTITY_GRAPH_TYPE,
  category: 'visualizations',
  name: 'Entity graph',
  description:
    'A clickable graph of the dependencies and relations around one entity. Works best at 6x4 or larger.',
  configSchema: entityGraphWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  },
  component: EntityGraph,
  createDefaultProps: () => ({ config: { entityId: '', depth: 1, direction: 'both' } }),
  configForm: EntityGraphConfigForm,
  icon: TbVectorTriangle,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['id', 'depth', 'direction'],
    normalizeProps: normalizeEntityGraphProps,
    mapProps: props => ({
      config: {
        entityId: props.id ?? '',
        depth: normalizeEntityGraphDepth(props.depth),
        direction: normalizeEntityGraphDirection(props.direction)
      }
    }),
    editorSpec: {
      editableComponent: EntityGraphEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityGraphMdxRule,
      slashCommand: {
        keywords: ['entity', 'graph', 'dependency', 'impact', 'relations'],
        onSelect: (editor, { insertOrReplaceBlock }) => {
          insertOrReplaceBlock(editor, {
            type: ENTITY_GRAPH_TYPE,
            entityId: '',
            depth: 1,
            direction: 'both',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
