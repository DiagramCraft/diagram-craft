import type React from 'react';
import { TbHistory } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityChangelog } from './EntityChangelog';
import {
  ENTITY_CHANGELOG_TYPE,
  EntityChangelogEditable,
  entityChangelogMdxRule
} from './EntityChangelogEditable';

export const entityChangelogSpec = {
  component: EntityChangelog as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['id', 'schema', 'owner', 'lifecycle', 'limit', 'since'],
  editorSpec: {
    editableComponent: EntityChangelogEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const },
    mdxRule: entityChangelogMdxRule,
    slashCommand: {
      key: 'entity-changelog',
      label: 'Entity Changelog',
      description: 'Embed a live feed of recent entity changes',
      icon: <TbHistory size={14} />,
      keywords: ['changelog', 'audit', 'history', 'changes', 'entity'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_CHANGELOG_TYPE,
          entityId: '',
          schema: '',
          owner: '',
          lifecycle: '',
          limit: '',
          since: '30d',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
