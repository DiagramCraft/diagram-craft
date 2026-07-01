import type React from 'react';
import { TbListSearch } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import {
  ENTITY_BROWSER_EMBED_TYPE,
  EntityBrowserEmbedEditable,
  entityBrowserEmbedMdxRule
} from './EntityBrowserEmbedEditable';

export const entityBrowserEmbedSpec = {
  component: EntityBrowserEmbed as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['config'],
  editorSpec: {
    editableComponent: EntityBrowserEmbedEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const },
    mdxRule: entityBrowserEmbedMdxRule,
    slashCommand: {
      key: 'entity-browser-embed',
      label: 'Entity Browser',
      description: 'Embed a fully configurable, live entity browser',
      icon: <TbListSearch size={14} />,
      keywords: ['entity', 'browser', 'embed', 'search', 'filter', 'catalog'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_BROWSER_EMBED_TYPE,
          config: '',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
