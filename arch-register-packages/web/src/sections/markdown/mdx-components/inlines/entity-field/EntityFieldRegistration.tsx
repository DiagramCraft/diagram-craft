import { TbHash } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityField } from './EntityField';
import { ENTITY_FIELD_TYPE, EntityFieldEditable, entityFieldMdxRule } from './EntityFieldEditable';
import type { EntityFieldSlateElement } from './types';

export const entityFieldSpec = defineMdxComponent<
  EntityFieldSlateElement,
  { id: string; field: string },
  'inline'
>({
  component: EntityField,
  mode: 'inline',
  allowedProps: ['id', 'field'],
  editorSpec: {
    editableComponent: EntityFieldEditable,
    nodeOptions: { isVoid: true, isInline: true },
    mdxRule: entityFieldMdxRule,
    slashCommand: {
      key: 'entity-field',
      label: 'Entity field',
      description: 'Show a live field value from an entity inside a sentence',
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
});
