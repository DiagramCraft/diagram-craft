import { TbLayoutGrid } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityViewEmbed } from './EntityViewEmbed';
import {
  ENTITY_VIEW_EMBED_TYPE,
  EntityViewEmbedEditable,
  entityViewEmbedMdxRule
} from './EntityViewEmbedEditable';
import type { EntityViewEmbedSlateElement } from './types';

export const entityViewEmbedSpec = defineMdxComponent<
  EntityViewEmbedSlateElement,
  { viewId?: string },
  'block'
>({
  component: EntityViewEmbed,
  mode: 'block',
  allowedProps: ['viewId'],
  editorSpec: {
    editableComponent: EntityViewEmbedEditable,
    nodeOptions: { isVoid: true },
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
});
