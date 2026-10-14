import { TbLink } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityLink } from './EntityLink';
import { ENTITY_LINK_TYPE, EntityLinkEditable, entityLinkMdxRule } from './EntityLinkEditable';
export default defineComponent({
  type: ENTITY_LINK_TYPE,
  category: 'data-views',
  name: 'Entity link',
  description: 'A plain link to an entity page',
  component: EntityLink,
  icon: TbLink,
  mdxComponent: {
    mode: 'inline',
    allowedProps: ['id'],
    editorSpec: {
      editableComponent: EntityLinkEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: entityLinkMdxRule,
      slashCommand: {
        keywords: ['link', 'entity', 'reference', 'href'],
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
