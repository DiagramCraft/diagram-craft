import { TbId } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityCard } from './EntityCard';
import { ENTITY_CARD_TYPE, EntityCardEditable, entityCardMdxRule } from './EntityCardEditable';
import type { EntityCardSlateElement } from './types';

export const entityCardSpec = defineMdxComponent<
  EntityCardSlateElement,
  { id: string; fields?: string },
  'block'
>({
  component: EntityCard,
  mode: 'block',
  allowedProps: ['id', 'fields'],
  editorSpec: {
    editableComponent: EntityCardEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityCardMdxRule,
    slashCommand: {
      key: 'entity-card',
      label: 'Entity Card',
      description: 'Embed entity metadata inline',
      icon: <TbId size={14} />,
      keywords: ['entity', 'card', 'catalog', 'service'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_CARD_TYPE,
          entityId: '',
          children: [{ text: '' }]
        });
      }
    }
  }
});
