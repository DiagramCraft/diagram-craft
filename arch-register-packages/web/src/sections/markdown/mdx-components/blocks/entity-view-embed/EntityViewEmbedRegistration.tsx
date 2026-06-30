import type React from 'react';
import { TbLayoutGrid } from 'react-icons/tb';
import type { MdxComponentSpec } from '../../types';
import { EntityViewEmbed } from './EntityViewEmbed';
import {
  ENTITY_VIEW_EMBED_TYPE,
  EntityViewEmbedEditable,
  entityViewEmbedMdxRule
} from './EntityViewEmbedEditable';

export const entityViewEmbedSpec = {
  component: EntityViewEmbed as unknown as React.ComponentType<Record<string, string>>,
  mode: 'block',
  allowedProps: ['viewId'],
  editorSpec: {
    editableComponent: EntityViewEmbedEditable as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    nodeOptions: { isVoid: true as const },
    mdxRule: entityViewEmbedMdxRule,
    slashCommand: {
      key: 'entity-view-embed',
      label: 'Entity View',
      description: 'Embed a live entity view from a saved view',
      icon: <TbLayoutGrid size={14} />,
      keywords: ['entity', 'view', 'embed', 'saved', 'catalog'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_VIEW_EMBED_TYPE,
          viewId: '',
          children: [{ text: '' }]
        });
      }
    }
  }
} satisfies MdxComponentSpec;
