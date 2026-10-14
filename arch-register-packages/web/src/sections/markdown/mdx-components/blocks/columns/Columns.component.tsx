import type React from 'react';
import { TbColumns } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Columns } from './Columns';
import { COLUMN_TYPE } from './ColumnEditable';
import { COLUMNS_TYPE, ColumnsEditable, columnsMdxRule } from './ColumnsEditable';
import type { ColumnsSlateElement } from './types';
export default defineComponent<
  ColumnsSlateElement,
  { count?: string; children?: React.ReactNode },
  'block'
>({
  type: COLUMNS_TYPE,
  category: 'content-layout',
  name: 'Columns',
  description: 'Lay out content side by side',
  component: Columns,
  icon: TbColumns,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['count'],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: ColumnsEditable,
      nodeOptions: {},
      mdxRule: columnsMdxRule,
      slashCommand: {
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
  }
});
