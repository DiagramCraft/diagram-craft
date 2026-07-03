import type React from 'react';
import { TbFrame } from 'react-icons/tb';
import type { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import type { MdxComponentSpec } from '../../types';
import { Caption } from './Caption';
import { CAPTION_TYPE, CaptionEditable, captionMdxRule } from './CaptionEditable';

export const captionSpec = {
  component: Caption as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['caption', 'align', 'numbered'],
  acceptsChildren: true,
  editorSpec: {
    editableComponent: CaptionEditable as unknown as React.ComponentType<Record<string, unknown>>,
    nodeOptions: {},
    mdxRule: captionMdxRule,
    slashCommand: {
      key: 'caption',
      label: 'Caption',
      description: 'Wrap a block with a figure caption',
      icon: <TbFrame size={14} />,
      keywords: ['caption', 'figure', 'figcaption'],
      onSelect: (
        editor: ReturnType<typeof useEditorRef>,
        {
          insertOrReplaceBlock
        }: {
          insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: TElement) => void;
        }
      ) => {
        insertOrReplaceBlock(editor, {
          type: CAPTION_TYPE,
          caption: '',
          align: '',
          numbered: false,
          children: [{ type: 'p', children: [{ text: '' }] }]
        });
      }
    },
    createWrapper: (child: TElement) => ({
      type: CAPTION_TYPE,
      caption: '',
      align: '',
      numbered: false,
      children: [child]
    })
  }
} satisfies MdxComponentSpec;
