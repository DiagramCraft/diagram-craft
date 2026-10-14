import type React from 'react';
import { TbInfoCircle } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Callout } from './Callout';
import { CALLOUT_TYPE, CalloutEditable, calloutMdxRule } from './CalloutEditable';
import type { CalloutSlateElement } from './types';

export const calloutSpec = defineComponent<
  CalloutSlateElement,
  { variant?: string; children?: React.ReactNode },
  'block'
>({
  type: CALLOUT_TYPE,
  category: 'content-layout',
  name: 'Callout',
  description: 'Highlight a note, warning, or tip',
  mdxComponent: {
    component: Callout,
    mode: 'block',
    allowedProps: ['variant'],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: CalloutEditable,
      nodeOptions: {},
      mdxRule: calloutMdxRule,
      slashCommand: {
        icon: <TbInfoCircle size={14} />,
        keywords: ['callout', 'note', 'warning', 'tip', 'info', 'danger', 'success', 'admonition'],
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
