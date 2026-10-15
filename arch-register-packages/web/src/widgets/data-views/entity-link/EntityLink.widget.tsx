import { TbLink } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { EntityLink } from './EntityLink';
import { ENTITY_LINK_TYPE, EntityLinkEditable, entityLinkMdxRule } from './EntityLinkEditable';
export default defineWidget({
  type: ENTITY_LINK_TYPE,
  category: 'data-views',
  name: 'Entity link',
  description: 'A plain link to an entity page',
  keywords: ['link', 'entity', 'reference', 'href'],
  component: EntityLink,
  icon: TbLink,
  mdx: {
    mode: 'inline',
    allowedProps: ['id'],
    editorSpec: {
      editableComponent: EntityLinkEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: entityLinkMdxRule,
      slashCommand: {
        onSelect: (editor, { insertOrReplaceInline }) => {
          insertOrReplaceInline(editor, {
            type: ENTITY_LINK_TYPE,
            entityId: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
