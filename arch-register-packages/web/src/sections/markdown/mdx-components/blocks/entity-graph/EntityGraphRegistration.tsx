import { TbVectorTriangle } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityGraph } from './EntityGraph';
import { ENTITY_GRAPH_TYPE, EntityGraphEditable, entityGraphMdxRule } from './EntityGraphEditable';
import { normalizeEntityGraphProps, type EntityGraphSlateElement } from './types';

export const entityGraphSpec = defineMdxComponent<
  EntityGraphSlateElement,
  { id: string; depth?: string; direction?: string },
  'block'
>({
  component: EntityGraph,
  mode: 'block',
  allowedProps: ['id', 'depth', 'direction'],
  normalizeProps: normalizeEntityGraphProps,
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
