import type React from 'react';
import { TbColumns } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { Columns } from './Columns';
import { COLUMN_TYPE } from './ColumnEditable';
import { COLUMNS_TYPE, ColumnsEditable, columnsMdxRule } from './ColumnsEditable';
import type { ColumnsSlateElement } from './types';

export const columnsSpec = defineMdxComponent<
  ColumnsSlateElement,
  { count?: string; children?: React.ReactNode },
  'block'
>({
  component: Columns,
  mode: 'block',
  allowedProps: ['count'],
  acceptsRichContent: true,
  editorSpec: {
    editableComponent: ColumnsEditable,
    nodeOptions: {},
    mdxRule: columnsMdxRule,
    slashCommand: {
      key: 'columns',
      label: 'Columns',
      description: 'Lay out content side by side',
      icon: <TbColumns size={14} />,
      keywords: ['columns', 'layout', 'grid', 'side-by-side'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: COLUMNS_TYPE,
          count: '2',
          children: [
            { type: COLUMN_TYPE, children: [{ type: 'p', children: [{ text: '' }] }] },
            { type: COLUMN_TYPE, children: [{ type: 'p', children: [{ text: '' }] }] }
          ]
        });
      }
    }
  }
});
