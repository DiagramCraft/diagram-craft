import { TbAt } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityMention } from './EntityMention';
import {
  ENTITY_MENTION_TYPE,
  EntityMentionEditable,
  entityMentionMdxRule
} from './EntityMentionEditable';
import type { EntityMentionSlateElement } from './types';

export const entityMentionSpec = defineMdxComponent<
  EntityMentionSlateElement,
  { id: string },
  'inline'
>({
  component: EntityMention,
  mode: 'inline',
  allowedProps: ['id'],
  editorSpec: {
    editableComponent: EntityMentionEditable,
    nodeOptions: { isVoid: true, isInline: true },
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
});
