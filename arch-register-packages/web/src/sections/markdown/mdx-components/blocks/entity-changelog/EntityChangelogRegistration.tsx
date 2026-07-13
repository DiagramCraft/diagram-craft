import { TbHistory } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityChangelog } from './EntityChangelog';
import {
  ENTITY_CHANGELOG_TYPE,
  EntityChangelogEditable,
  entityChangelogMdxRule
} from './EntityChangelogEditable';
import type { EntityChangelogSlateElement } from './types';

export const entityChangelogSpec = defineMdxComponent<
  EntityChangelogSlateElement,
  {
    id?: string;
    schema?: string;
    owner?: string;
    lifecycle?: string;
    limit?: string;
    since?: string;
  },
  'block'
>({
  component: EntityChangelog,
  mode: 'block',
  allowedProps: ['id', 'schema', 'owner', 'lifecycle', 'limit', 'since'],
  editorSpec: {
    editableComponent: EntityChangelogEditable,
    nodeOptions: { isVoid: true },
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
});
