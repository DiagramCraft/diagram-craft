import { TbTag } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Label } from './Label';
import { LABEL_TYPE, LabelEditable, labelMdxRule } from './LabelEditable';
import type { LabelSlateElement } from './types';

export const labelSpec = defineComponent<
  LabelSlateElement,
  { text: string; color: string },
  'inline'
>({
  type: LABEL_TYPE,
  category: 'content-layout',
  name: 'Label',
  description: 'Insert a free-standing colored status label',
  mdxComponent: {
    component: Label,
    mode: 'inline',
    allowedProps: ['text', 'color'],
    editorSpec: {
      editableComponent: LabelEditable,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: labelMdxRule,
      slashCommand: {
        icon: <TbTag size={14} />,
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
