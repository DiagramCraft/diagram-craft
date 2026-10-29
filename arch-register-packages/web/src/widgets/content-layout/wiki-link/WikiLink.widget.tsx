import { TbFileText } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { WikiLink } from './WikiLink';
import { WIKI_LINK_TYPE, WikiLinkEditable, wikiLinkMdxRule } from './WikiLinkEditable';
export default defineWidget({
  type: WIKI_LINK_TYPE,
  category: 'content-layout',
  name: 'Wiki page link',
  description: 'A link to another wiki page',
  keywords: ['link', 'wiki', 'page', 'document', 'reference'],
  component: WikiLink,
  icon: TbFileText,
  mdx: {
    mode: 'inline',
    allowedProps: ['id'],
    editorSpec: {
      editableComponent: WikiLinkEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: wikiLinkMdxRule,
      slashCommand: {
        onSelect: (editor, { insertOrReplaceInline }) => {
          insertOrReplaceInline(editor, {
            type: WIKI_LINK_TYPE,
            nodeId: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
