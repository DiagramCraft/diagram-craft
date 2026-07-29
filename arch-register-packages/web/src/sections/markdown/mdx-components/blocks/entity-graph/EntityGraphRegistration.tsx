import { TbVectorTriangle } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityGraph } from './EntityGraph';
import { EntityGraphWidget } from '../../../../dashboard/widgets/EntityGraphWidget';
import { ENTITY_GRAPH_TYPE, EntityGraphEditable, entityGraphMdxRule } from './EntityGraphEditable';
import {
  normalizeEntityGraphProps,
  type EntityGraphSlateElement,
  type EntityGraphWidgetConfig
} from './types';

export const entityGraphSpec = defineMdxComponent<
  EntityGraphSlateElement,
  { id: string; depth?: string; direction?: string },
  'block'
>({
  component: EntityGraph,
  mode: 'block',
  allowedProps: ['id', 'depth', 'direction'],
  normalizeProps: normalizeEntityGraphProps,
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbVectorTriangle,
    label: 'Entity graph',
    description:
      'A clickable dependency and relationship graph for one entity. Works best at 6x4 or larger.',
    defaultW: 6,
    defaultH: 4,
    surfaces: ['workspace', 'project'],
    component: EntityGraphWidget,
    isValidConfig: (config): config is EntityGraphWidgetConfig =>
      typeof config.entityId === 'string',
    createDefaultConfig: () => ({ entityId: '', depth: 1, direction: 'both' }),
    getTitle: () => 'Entity graph'
  },
  editorSpec: {
    editableComponent: EntityGraphEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityGraphMdxRule,
    slashCommand: {
      key: 'entity-graph',
      label: 'Entity Graph',
      description: 'Embed a clickable dependency or impact graph for one entity',
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
});
