import type React from 'react';
import { TbFrame } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Caption } from './Caption';
import { CAPTION_TYPE, CaptionEditable, captionMdxRule } from './CaptionEditable';
import type { CaptionSlateElement } from './types';

export const captionSpec = defineComponent<
  CaptionSlateElement,
  { caption?: string; numbered?: string; children?: React.ReactNode },
  'block'
>({
  type: CAPTION_TYPE,
  category: 'content-layout',
  surfaces: ['wiki'],
  component: Caption,
  mode: 'block',
  allowedProps: ['caption', 'numbered'],
  acceptsChildren: true,
  editorSpec: {
    editableComponent: CaptionEditable,
    nodeOptions: {},
    mdxRule: captionMdxRule,
    slashCommand: {
      label: 'Caption',
      description: 'Wrap a block with a figure caption',
      icon: <TbFrame size={14} />,
      keywords: ['caption', 'figure', 'figcaption'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: CAPTION_TYPE,
          caption: '',
          numbered: false,
          children: [{ type: 'p', children: [{ text: '' }] }]
        });
      }
    },
    createWrapper: child => ({
      type: CAPTION_TYPE,
      caption: '',
      numbered: false,
      children: [child]
    })
  }
});
