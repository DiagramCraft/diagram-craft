import type React from 'react';
import { TbHash } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityField } from './EntityField';
import { ENTITY_FIELD_TYPE, EntityFieldEditable, entityFieldMdxRule } from './EntityFieldEditable';

export const entityFieldSpec = {
  component: EntityField as unknown as React.ComponentType<Record<string, string>>,
  mode: 'inline',
  allowedProps: ['id', 'field'],
  editorSpec: {
    editableComponent: EntityFieldEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const, isInline: true as const },
    mdxRule: entityFieldMdxRule,
    slashCommand: {
      key: 'entity-field',
      label: 'Field Embed',
      description: 'Embed a live entity field value',
      icon: <TbHash size={14} />,
      keywords: ['field', 'entity', 'value', 'embed', 'inline'],
      onSelect: editor => {
        editor.tf.insertNodes({
          type: ENTITY_FIELD_TYPE,
          entityId: '',
          field: '',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
