import { TbVectorTriangle } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityGraph } from './EntityGraph';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
import { ENTITY_GRAPH_TYPE, EntityGraphEditable, entityGraphMdxRule } from './EntityGraphEditable';
import { EntityGraphConfigForm } from './EntityGraphConfigForm';
import {
  normalizeEntityGraphProps,
  type EntityGraphSlateElement,
  type EntityGraphWidgetConfig
} from './types';

export const entityGraphSpec = defineComponent<
  EntityGraphSlateElement,
  { id: string; depth?: string; direction?: string },
  'block'
>({
  type: ENTITY_GRAPH_TYPE,
  category: 'visualizations',
  name: 'Entity graph',
  description:
    'A clickable graph of the dependencies and relations around one entity. Works best at 6x4 or larger.',
  dashboardWidget: {
    icon: TbVectorTriangle,
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    component: createDashboardWidgetAdapter(EntityGraph, (config: EntityGraphWidgetConfig) => ({
      id: config.entityId,
      depth: config.depth != null ? String(config.depth) : undefined,
      direction: config.direction
    })),
    isValidConfig: (config): config is EntityGraphWidgetConfig =>
      typeof config.entityId === 'string' && config.entityId.length > 0,
    createDefaultConfig: () => ({ entityId: '', depth: 1, direction: 'both' }),
    getTitle: () => 'Entity graph',
    configForm: EntityGraphConfigForm
  },
  mdxComponent: {
    component: EntityGraph,
    mode: 'block',
    allowedProps: ['id', 'depth', 'direction'],
    normalizeProps: normalizeEntityGraphProps,
    editorSpec: {
      editableComponent: EntityGraphEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityGraphMdxRule,
      slashCommand: {
        icon: <TbVectorTriangle size={14} />,
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
