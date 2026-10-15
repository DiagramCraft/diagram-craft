import { TbChevronsDown } from 'react-icons/tb';
import { defineWidget } from '../../defineWidget';
import { FoldableSection } from './FoldableSection';
import {
  FOLDABLE_SECTION_TYPE,
  FoldableSectionEditable,
  foldableSectionMdxRule
} from './FoldableSectionEditable';
export default defineWidget({
  type: FOLDABLE_SECTION_TYPE,
  category: 'content-layout',
  name: 'Foldable section',
  description: 'Collapse content behind a summary label',
  keywords: ['fold', 'foldable', 'collapse', 'expand', 'details', 'summary', 'toggle'],
  component: FoldableSection,
  icon: TbChevronsDown,
  mdx: {
    mode: 'block',
    allowedProps: ['label'],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: FoldableSectionEditable,
      nodeOptions: {},
      mdxRule: foldableSectionMdxRule,
      slashCommand: {
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
