import { TbAt } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityMention } from './EntityMention';
import {
  ENTITY_MENTION_TYPE,
  EntityMentionEditable,
  entityMentionMdxRule
} from './EntityMentionEditable';
import type { EntityMentionSlateElement } from './types';
export default defineComponent<EntityMentionSlateElement, { id: string }, 'inline'>({
  type: ENTITY_MENTION_TYPE,
  category: 'data-views',
  name: 'Entity mention',
  description: 'Mention an entity with its live name and status',
  component: EntityMention,
  mdxComponent: {
    mode: 'inline',
    allowedProps: ['id'],
    editorSpec: {
      editableComponent: EntityMentionEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: entityMentionMdxRule,
      slashCommand: {
        icon: <TbAt size={14} />,
        keywords: ['mention', 'entity', '@', 'reference', 'link'],
        onSelect: (editor, { insertOrReplaceInline }) => {
          insertOrReplaceInline(editor, {
            type: ENTITY_MENTION_TYPE,
            entityId: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
