import { TbFrame } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Caption } from './Caption';
import { CAPTION_TYPE, CaptionEditable, captionMdxRule } from './CaptionEditable';
export default defineComponent({
  type: CAPTION_TYPE,
  category: 'content-layout',
  name: 'Caption',
  description: 'Wrap a block with a figure caption',
  keywords: ['caption', 'figure', 'figcaption'],
  component: Caption,
  icon: TbFrame,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['caption', 'numbered'],
    acceptsChildren: true,
    editorSpec: {
      editableComponent: CaptionEditable,
      nodeOptions: {},
      mdxRule: captionMdxRule,
      slashCommand: {
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
  }
});
