import { TbListSearch } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import {
  ENTITY_BROWSER_EMBED_TYPE,
  EntityBrowserEmbedEditable,
  entityBrowserEmbedMdxRule
} from './EntityBrowserEmbedEditable';
import type { EntityBrowserEmbedSlateElement } from './types';

export const entityBrowserEmbedSpec = defineMdxComponent<
  EntityBrowserEmbedSlateElement,
  { config?: string },
  'block'
>({
  component: EntityBrowserEmbed,
  mode: 'block',
  allowedProps: ['config'],
  editorSpec: {
    editableComponent: EntityBrowserEmbedEditable,
    nodeOptions: { isVoid: true },
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
});
