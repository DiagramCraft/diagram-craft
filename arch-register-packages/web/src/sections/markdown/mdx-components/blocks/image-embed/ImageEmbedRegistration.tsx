import type React from 'react';
import { TbPhoto } from 'react-icons/tb';
import type { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import type { MdxComponentSpec } from '../../types';
import { ImageEmbed } from './ImageEmbed';
import { IMAGE_EMBED_TYPE, ImageEmbedEditable, imageEmbedMdxRule } from './ImageEmbedEditable';

export const imageEmbedSpec = {
  component: ImageEmbed as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['id', 'alt', 'size', 'align'],
  editorSpec: {
    editableComponent: ImageEmbedEditable as unknown as React.ComponentType<Record<string, unknown>>,
    nodeOptions: { isVoid: true as const },
    mdxRule: imageEmbedMdxRule,
    slashCommand: {
      key: 'image-embed',
      label: 'Image Embed',
      description: 'Embed an uploaded image attachment',
      icon: <TbPhoto size={14} />,
      keywords: ['image', 'photo', 'attachment', 'picture'],
      onSelect: (
        editor: ReturnType<typeof useEditorRef>,
        { insertOrReplaceBlock }: { insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: TElement) => void }
      ) => {
        insertOrReplaceBlock(editor, {
          type: IMAGE_EMBED_TYPE,
          fileId: '',
          alt: '',
          size: '100',
          align: 'center',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
