import { TbLink } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityLink } from './EntityLink';
import { ENTITY_LINK_TYPE, EntityLinkEditable, entityLinkMdxRule } from './EntityLinkEditable';
import type { EntityLinkSlateElement } from './types';

export const entityLinkSpec = defineMdxComponent<EntityLinkSlateElement, { id: string }, 'inline'>({
  component: EntityLink,
  mode: 'inline',
  allowedProps: ['id'],
  editorSpec: {
    editableComponent: EntityLinkEditable,
    nodeOptions: { isVoid: true, isInline: true },
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
});
