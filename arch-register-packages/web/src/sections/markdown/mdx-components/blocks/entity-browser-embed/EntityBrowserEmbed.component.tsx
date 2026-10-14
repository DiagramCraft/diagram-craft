import { TbListSearch } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import {
  decodeEntityBrowserEmbedConfig,
  entityBrowserEmbedConfigSchema,
  type EntityBrowserEmbedConfig
} from './EntityBrowserEmbedCodec';
import {
  ENTITY_BROWSER_EMBED_TYPE,
  EntityBrowserEmbedEditable,
  entityBrowserEmbedMdxRule
} from './EntityBrowserEmbedEditable';
import { EntityBrowserEmbedConfigForm } from './EntityBrowserEmbedConfigForm';

export default defineComponent({
  type: ENTITY_BROWSER_EMBED_TYPE,
  category: 'data-views',
  name: 'Entity browser',
  description:
    'A live, searchable list of entities with your own filters, sorting and columns. Use it for a flexible catalog view.',
  configSchema: entityBrowserEmbedConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    dialogWidth: 'min(1200px, 92vw)'
  },
  component: EntityBrowserEmbed,
  configForm: EntityBrowserEmbedConfigForm,
  icon: TbListSearch,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['config'],
    mapProps: (props, defaultProps) => ({
      ...defaultProps,
      config:
        decodeEntityBrowserEmbedConfig(
          props.config,
          defaultProps.config as EntityBrowserEmbedConfig
        ) ?? (defaultProps.config as EntityBrowserEmbedConfig)
    }),
    editorSpec: {
      editableComponent: EntityBrowserEmbedEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityBrowserEmbedMdxRule,
      slashCommand: {
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
  }
});
