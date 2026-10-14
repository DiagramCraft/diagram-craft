import type React from 'react';
import { TbChevronsDown } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { FoldableSection } from './FoldableSection';
import {
  FOLDABLE_SECTION_TYPE,
  FoldableSectionEditable,
  foldableSectionMdxRule
} from './FoldableSectionEditable';
import type { FoldableSectionSlateElement } from './types';

export const foldableSectionSpec = defineComponent<
  FoldableSectionSlateElement,
  { label?: string; children?: React.ReactNode },
  'block'
>({
  type: FOLDABLE_SECTION_TYPE,
  category: 'content-layout',
  surfaces: ['wiki'],

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
      label: 'Foldable section',
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
