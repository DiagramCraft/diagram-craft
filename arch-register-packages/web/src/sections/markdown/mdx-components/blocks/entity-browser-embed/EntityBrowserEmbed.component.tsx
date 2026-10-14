import { TbListSearch } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
import { encodeEntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';
import {
  ENTITY_BROWSER_EMBED_TYPE,
  EntityBrowserEmbedEditable,
  entityBrowserEmbedMdxRule
} from './EntityBrowserEmbedEditable';
import { EntityBrowserEmbedConfigForm } from './EntityBrowserEmbedConfigForm';
import type { EntityBrowserEmbedSlateElement } from './types';
import type { EntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';

const isEntityBrowserEmbedConfig = (
  config: Record<string, unknown>
): config is EntityBrowserEmbedConfig =>
  typeof config.q === 'string' &&
  Array.isArray(config.conditions) &&
  typeof config.sort === 'string' &&
  typeof config.view === 'string' &&
  typeof config.viewConfigs === 'object' &&
  config.viewConfigs !== null &&
  (config.limit === undefined || typeof config.limit === 'number') &&
  (config.interactive === undefined || typeof config.interactive === 'boolean');
export default defineComponent<EntityBrowserEmbedSlateElement, { config?: string }, 'block'>({
  type: ENTITY_BROWSER_EMBED_TYPE,
  category: 'data-views',
  name: 'Entity browser',
  description:
    'A live, searchable list of entities with your own filters, sorting and columns. Use it for a flexible catalog view.',
  dashboardWidget: {
    icon: TbListSearch,
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    component: createDashboardWidgetAdapter(
      EntityBrowserEmbed,
      (config: EntityBrowserEmbedConfig) => ({ config: encodeEntityBrowserEmbedConfig(config) })
    ),
    isValidConfig: isEntityBrowserEmbedConfig,
    createDefaultConfig: () => ({
      q: '',
      conditions: [],
      sort: 'name',
      view: 'table',
      viewConfigs: {}
    }),
    getTitle: () => 'Entity browser',
    configForm: EntityBrowserEmbedConfigForm,
    dialogWidth: 'min(1200px, 92vw)'
  },
  mdxComponent: {
    component: EntityBrowserEmbed,
    mode: 'block',
    allowedProps: ['config'],
    editorSpec: {
      editableComponent: EntityBrowserEmbedEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityBrowserEmbedMdxRule,
      slashCommand: {
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
  }
});
