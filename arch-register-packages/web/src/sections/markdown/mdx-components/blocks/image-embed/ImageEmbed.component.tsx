import { TbPhoto } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { ImageEmbed } from './ImageEmbed';
import { IMAGE_EMBED_TYPE, ImageEmbedEditable, imageEmbedMdxRule } from './ImageEmbedEditable';
import type { ImageEmbedSlateElement } from './types';
export default defineComponent<
  ImageEmbedSlateElement,
  { id: string; alt?: string; size?: string; align?: string },
  'block'
>({
  type: IMAGE_EMBED_TYPE,
  category: 'content-layout',
  name: 'Image',
  description: 'Embed an uploaded image attachment',
  mdxComponent: {
    component: ImageEmbed,
    mode: 'block',
    allowedProps: ['id', 'alt', 'size', 'align'],
    editorSpec: {
      editableComponent: ImageEmbedEditable,
      nodeOptions: { isVoid: true },
      mdxRule: imageEmbedMdxRule,
      slashCommand: {
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
  }
});
