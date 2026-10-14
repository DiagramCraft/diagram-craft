import { TbHash } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityField } from './EntityField';
import { ENTITY_FIELD_TYPE, EntityFieldEditable, entityFieldMdxRule } from './EntityFieldEditable';
import type { EntityFieldSlateElement } from './types';
export default defineComponent<EntityFieldSlateElement, { id: string; field: string }, 'inline'>({
  type: ENTITY_FIELD_TYPE,
  category: 'metrics',
  name: 'Entity field',
  description: 'Show a live field value from an entity inside a sentence',
  mdxComponent: {
    component: EntityField,
    mode: 'inline',
    allowedProps: ['id', 'field'],
    editorSpec: {
      editableComponent: EntityFieldEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: entityFieldMdxRule,
      slashCommand: {
        icon: <TbHash size={14} />,
        keywords: ['field', 'entity', 'value', 'embed', 'inline'],
        onSelect: (editor, { insertOrReplaceInline }) => {
          insertOrReplaceInline(editor, {
            type: ENTITY_FIELD_TYPE,
            entityId: '',
            field: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
