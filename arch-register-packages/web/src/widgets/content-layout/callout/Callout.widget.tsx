import { TbInfoCircle } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { Callout } from './Callout';
import { CALLOUT_TYPE, CalloutEditable, calloutMdxRule } from './CalloutEditable';
export default defineWidget({
  type: CALLOUT_TYPE,
  category: 'content-layout',
  name: 'Callout',
  description: 'Highlight a note, warning, or tip',
  keywords: ['callout', 'note', 'warning', 'tip', 'info', 'danger', 'success', 'admonition'],
  component: Callout,
  icon: TbInfoCircle,
  mdx: {
    mode: 'block',
    allowedProps: ['variant'],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: CalloutEditable,
      nodeOptions: {},
      mdxRule: calloutMdxRule,
      slashCommand: {
        onSelect: (editor, { insertOrReplaceBlock }) => {
          insertOrReplaceBlock(editor, {
            type: CALLOUT_TYPE,
            variant: 'info',
            children: [{ type: 'p', children: [{ text: '' }] }]
          });
        }
      }
    }
  }
});
