import { TbTag } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Label } from './Label';
import { LABEL_TYPE, LabelEditable, labelMdxRule } from './LabelEditable';
export default defineComponent({
  type: LABEL_TYPE,
  category: 'content-layout',
  name: 'Label',
  description: 'Insert a free-standing colored status label',
  component: Label,
  icon: TbTag,
  mdxComponent: {
    mode: 'inline',
    allowedProps: ['text', 'color'],
    editorSpec: {
      editableComponent: LabelEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: labelMdxRule,
      slashCommand: {
        keywords: ['label', 'status', 'chip', 'tag', 'badge'],
        onSelect: (editor, { insertOrReplaceInline }) => {
          insertOrReplaceInline(editor, {
            type: LABEL_TYPE,
            content: '',
            color: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
