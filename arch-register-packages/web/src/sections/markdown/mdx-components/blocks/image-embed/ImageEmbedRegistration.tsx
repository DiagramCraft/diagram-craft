import { TbPhoto } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { ImageEmbed } from './ImageEmbed';
import { IMAGE_EMBED_TYPE, ImageEmbedEditable, imageEmbedMdxRule } from './ImageEmbedEditable';
import type { ImageEmbedSlateElement } from './types';

export const imageEmbedSpec = defineMdxComponent<
  ImageEmbedSlateElement,
  { id: string; alt?: string; size?: string; align?: string },
  'block'
>({
  component: ImageEmbed,
  mode: 'block',
  allowedProps: ['id', 'alt', 'size', 'align'],
  editorSpec: {
    editableComponent: ImageEmbedEditable,
    nodeOptions: { isVoid: true },
    mdxRule: imageEmbedMdxRule,
    slashCommand: {
      key: 'image-embed',
      label: 'Image Embed',
      description: 'Embed an uploaded image attachment',
      icon: <TbPhoto size={14} />,
      keywords: ['image', 'photo', 'attachment', 'picture'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
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
});
