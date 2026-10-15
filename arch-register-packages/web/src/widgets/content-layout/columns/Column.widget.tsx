import { defineWidget } from '../../shared/defineWidget';
import { Column } from './Column';
import { COLUMN_TYPE } from './ColumnEditable';
import { ColumnEditable, columnMdxRule } from './ColumnEditable';
import type {} from './types'; // Column is never inserted on its own — it's only ever created (and destroyed)
// by Columns' own slash-command insertion and preset-switch logic, so this spec
// deliberately has no slashCommand.
export default defineWidget({
  type: COLUMN_TYPE,
  category: 'content-layout',
  name: 'Column',
  description: 'A column within a multi-column layout.',
  component: Column,
  mdx: {
    mode: 'block',
    allowedProps: [],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: ColumnEditable,
      nodeOptions: {},
      mdxRule: columnMdxRule
    }
  }
});
