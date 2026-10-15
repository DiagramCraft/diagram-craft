import { TbAt } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityMention } from './EntityMention';
import {
  ENTITY_MENTION_TYPE,
  EntityMentionEditable,
  entityMentionMdxRule
} from './EntityMentionEditable';
export default defineComponent({
  type: ENTITY_MENTION_TYPE,
  category: 'data-views',
  name: 'Entity mention',
  description: 'Mention an entity with its live name and status',
  keywords: ['mention', 'entity', '@', 'reference', 'link'],
  component: EntityMention,
  icon: TbAt,
  mdxComponent: {
    mode: 'inline',
    allowedProps: ['id'],
    editorSpec: {
      editableComponent: EntityMentionEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: entityMentionMdxRule,
      slashCommand: {
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
