import type React from 'react';
import { TbFrame } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { Caption } from './Caption';
import { CAPTION_TYPE, CaptionEditable, captionMdxRule } from './CaptionEditable';
import type { CaptionSlateElement } from './types';

export const captionSpec = defineMdxComponent<
  CaptionSlateElement,
  { caption?: string; align?: string; numbered?: string; children?: React.ReactNode },
  'block'
>({
  component: Caption,
  mode: 'block',
  allowedProps: ['caption', 'align', 'numbered'],
  acceptsChildren: true,
  editorSpec: {
    editableComponent: CaptionEditable,
    nodeOptions: {},
    mdxRule: captionMdxRule,
    slashCommand: {
      key: 'caption',
      label: 'Caption',
      description: 'Wrap a block with a figure caption',
      icon: <TbFrame size={14} />,
      keywords: ['caption', 'figure', 'figcaption'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: CAPTION_TYPE,
          caption: '',
          align: '',
          numbered: false,
          children: [{ type: 'p', children: [{ text: '' }] }]
        });
      }
    },
    createWrapper: child => ({
      type: CAPTION_TYPE,
      caption: '',
      align: '',
      numbered: false,
      children: [child]
    })
  }
});
