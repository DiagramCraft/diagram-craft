import type React from 'react';
import { TbTable } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityTable } from './EntityTable';
import {
  ENTITY_TABLE_TYPE,
  EntityTableEditable,
  entityTableMdxRule
} from './EntityTableEditable';

export const entityTableSpec = {
  component: EntityTable as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['schema', 'owner', 'lifecycle', 'limit'],
  editorSpec: {
    editableComponent: EntityTableEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const },
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
} satisfies MdxComponentSpec;
