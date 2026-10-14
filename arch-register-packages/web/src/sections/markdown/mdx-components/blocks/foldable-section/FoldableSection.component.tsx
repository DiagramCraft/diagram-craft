import { TbChevronsDown } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { FoldableSection } from './FoldableSection';
import {
  FOLDABLE_SECTION_TYPE,
  FoldableSectionEditable,
  foldableSectionMdxRule
} from './FoldableSectionEditable';
export default defineComponent({
  type: FOLDABLE_SECTION_TYPE,
  category: 'content-layout',
  name: 'Foldable section',
  description: 'Collapse content behind a summary label',
  component: FoldableSection,
  icon: TbChevronsDown,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['label'],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: FoldableSectionEditable,
      nodeOptions: {},
      mdxRule: foldableSectionMdxRule,
      slashCommand: {
        keywords: ['fold', 'foldable', 'collapse', 'expand', 'details', 'summary', 'toggle'],
        onSelect: (editor, { insertOrReplaceBlock }) => {
          insertOrReplaceBlock(editor, {
            type: FOLDABLE_SECTION_TYPE,
            label: '',
            children: [{ type: 'p', children: [{ text: '' }] }]
          });
        }
      }
    }
  }
});
