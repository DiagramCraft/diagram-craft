import type React from 'react';
import { TbInfoCircle } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { Callout } from './Callout';
import { CALLOUT_TYPE, CalloutEditable, calloutMdxRule } from './CalloutEditable';
import type { CalloutSlateElement } from './types';

export const calloutSpec = defineMdxComponent<
  CalloutSlateElement,
  { variant?: string; children?: React.ReactNode },
  'block'
>({
  component: Callout,
  mode: 'block',
  allowedProps: ['variant'],
  acceptsRichContent: true,
  editorSpec: {
    editableComponent: CalloutEditable,
    nodeOptions: {},
    mdxRule: calloutMdxRule,
    slashCommand: {
      key: 'callout',
      label: 'Callout',
      description: 'Highlight a note, warning, or tip',
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
});
