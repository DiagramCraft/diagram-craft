import { TbTable } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityTable } from './EntityTable';
import {
  ENTITY_TABLE_TYPE,
  EntityTableEditable,
  entityTableMdxRule
} from './EntityTableEditable';
import type { EntityTableSlateElement } from './types';

export const entityTableSpec = defineMdxComponent<
  EntityTableSlateElement,
  { schema?: string; owner?: string; lifecycle?: string; limit?: string },
  'block'
>({
  component: EntityTable,
  mode: 'block',
  allowedProps: ['schema', 'owner', 'lifecycle', 'limit'],
  editorSpec: {
    editableComponent: EntityTableEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityTableMdxRule,
    slashCommand: {
      key: 'entity-table',
      label: 'Entity Table',
      description: 'Embed a live entity table from inline filters',
      icon: <TbTable size={14} />,
      keywords: ['entity', 'table', 'catalog', 'list', 'filter'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_TABLE_TYPE,
          schema: '',
          owner: '',
          lifecycle: '',
          limit: '10',
          children: [{ text: '' }]
        });
      }
    }
  }
});
