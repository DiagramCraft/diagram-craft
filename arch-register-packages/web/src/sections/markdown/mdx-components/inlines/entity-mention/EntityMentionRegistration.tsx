import type React from 'react';
import { TbAt } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityMention } from './EntityMention';
import { ENTITY_MENTION_TYPE, EntityMentionEditable, entityMentionMdxRule } from './EntityMentionEditable';

export const entityMentionSpec = {
  component: EntityMention as unknown as React.ComponentType<Record<string, string>>,
  mode: 'inline',
  allowedProps: ['id'],
  editorSpec: {
    editableComponent: EntityMentionEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const, isInline: true as const },
    mdxRule: entityMentionMdxRule,
    slashCommand: {
      key: 'entity-mention',
      label: 'Entity Mention',
      description: 'Mention an entity with live name and status',
      icon: <TbAt size={14} />,
      keywords: ['mention', 'entity', '@', 'reference', 'link'],
      onSelect: editor => {
        editor.tf.insertNodes({
          type: ENTITY_MENTION_TYPE,
          entityId: '',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
