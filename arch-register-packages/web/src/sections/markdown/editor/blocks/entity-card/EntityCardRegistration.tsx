import type React from 'react';
import { TbId } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../../types';
import { EntityCard } from './EntityCard';
import { ENTITY_CARD_TYPE, EntityCardEditable, entityCardMdxRule } from './EntityCardEditable';

export const entityCardSpec = {
  component: EntityCard as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['id', 'fields'],
  editorSpec: {
    editableComponent: EntityCardEditable as unknown as React.ComponentType<Record<string, unknown>>,
    nodeOptions: { isVoid: true as const },
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
} satisfies MdxComponentSpec;
