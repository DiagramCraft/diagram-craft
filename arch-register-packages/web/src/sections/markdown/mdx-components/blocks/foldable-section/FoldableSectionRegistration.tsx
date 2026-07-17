import type React from 'react';
import { TbChevronsDown } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { FoldableSection } from './FoldableSection';
import {
  FOLDABLE_SECTION_TYPE,
  FoldableSectionEditable,
  foldableSectionMdxRule
} from './FoldableSectionEditable';
import type { FoldableSectionSlateElement } from './types';

export const foldableSectionSpec = defineMdxComponent<
  FoldableSectionSlateElement,
  { label?: string; children?: React.ReactNode },
  'block'
>({
  component: FoldableSection,
  mode: 'block',
  allowedProps: ['label'],
  acceptsRichContent: true,
  editorSpec: {
    editableComponent: FoldableSectionEditable,
    nodeOptions: {},
    mdxRule: foldableSectionMdxRule,
    slashCommand: {
      key: 'foldable-section',
      label: 'Foldable Section',
      description: 'Collapse content behind a summary label',
      icon: <TbChevronsDown size={14} />,
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
});
