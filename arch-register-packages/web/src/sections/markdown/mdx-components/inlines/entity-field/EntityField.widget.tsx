import { TbHash } from 'react-icons/tb';
import { defineWidget } from '../../defineWidget';
import { EntityField } from './EntityField';
import { ENTITY_FIELD_TYPE, EntityFieldEditable, entityFieldMdxRule } from './EntityFieldEditable';
export default defineWidget({
  type: ENTITY_FIELD_TYPE,
  category: 'metrics',
  name: 'Entity field',
  description: 'Show a live field value from an entity inside a sentence',
  keywords: ['field', 'entity', 'value', 'embed', 'inline'],
  component: EntityField,
  icon: TbHash,
  mdx: {
    mode: 'inline',
    allowedProps: ['id', 'field'],
    editorSpec: {
      editableComponent: EntityFieldEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: entityFieldMdxRule,
      slashCommand: {
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
