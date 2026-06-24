import type React from 'react';
import { TbLink } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityLink } from './EntityLink';
import { ENTITY_LINK_TYPE, EntityLinkEditable, entityLinkMdxRule } from './EntityLinkEditable';

export const entityLinkSpec = {
  component: EntityLink as unknown as React.ComponentType<Record<string, string>>,
  mode: 'inline',
  allowedProps: ['id'],
  editorSpec: {
    editableComponent: EntityLinkEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const, isInline: true as const },
    mdxRule: entityLinkMdxRule,
    slashCommand: {
      key: 'entity-link',
      label: 'Entity Link',
      description: 'Simple link to an entity',
      icon: <TbLink size={14} />,
      keywords: ['link', 'entity', 'reference', 'href'],
      onSelect: editor => {
        editor.tf.insertNodes({
          type: ENTITY_LINK_TYPE,
          entityId: '',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
