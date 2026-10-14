import type { ReactNode } from 'react';
import { defineComponent } from '../../defineComponent';
import { Column } from './Column';
import { COLUMN_TYPE } from './ColumnEditable';
import { ColumnEditable, columnMdxRule } from './ColumnEditable';
import type { ColumnSlateElement } from './types';

// Column is never inserted on its own — it's only ever created (and destroyed)
// by Columns' own slash-command insertion and preset-switch logic, so this spec
// deliberately has no slashCommand.
export const columnSpec = defineComponent<ColumnSlateElement, { children?: ReactNode }, 'block'>({
  type: COLUMN_TYPE,
  category: 'content-layout',
  surfaces: ['wiki'],

  component: Column,
  mode: 'block',
  allowedProps: [],
  acceptsRichContent: true,
  editorSpec: {
    editableComponent: ColumnEditable,
    nodeOptions: {},
    mdxRule: columnMdxRule
  }
});
