import { TbPhoto } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { ImageEmbed } from './ImageEmbed';
import { IMAGE_EMBED_TYPE, ImageEmbedEditable, imageEmbedMdxRule } from './ImageEmbedEditable';
export default defineComponent({
  type: IMAGE_EMBED_TYPE,
  category: 'content-layout',
  name: 'Image',
  description: 'Embed an uploaded image attachment',
  component: ImageEmbed,
  icon: TbPhoto,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['id', 'alt', 'size', 'align'],
    editorSpec: {
      editableComponent: ImageEmbedEditable,
      nodeOptions: { isVoid: true },
      mdxRule: imageEmbedMdxRule,
      slashCommand: {
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
