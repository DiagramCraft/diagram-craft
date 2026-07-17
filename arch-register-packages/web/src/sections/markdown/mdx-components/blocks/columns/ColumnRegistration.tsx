import type { ReactNode } from 'react';
import { defineMdxComponent } from '../../defineMdxComponent';
import { Column } from './Column';
import { ColumnEditable, columnMdxRule } from './ColumnEditable';
import type { ColumnSlateElement } from './types';

// Column is never inserted on its own — it's only ever created (and destroyed)
// by Columns' own slash-command insertion and preset-switch logic, so this spec
// deliberately has no slashCommand.
export const columnSpec = defineMdxComponent<ColumnSlateElement, { children?: ReactNode }, 'block'>(
  {
    component: Column,
    mode: 'block',
    allowedProps: [],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: ColumnEditable,
      nodeOptions: {},
      mdxRule: columnMdxRule
    }
  }
);
