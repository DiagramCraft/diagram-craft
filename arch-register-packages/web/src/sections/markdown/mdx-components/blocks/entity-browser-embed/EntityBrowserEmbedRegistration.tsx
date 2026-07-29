import { TbListSearch } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import { EntityBrowserEmbedWidget } from '../../../../dashboard/widgets/EntityBrowserEmbedWidget';
import {
  ENTITY_BROWSER_EMBED_TYPE,
  EntityBrowserEmbedEditable,
  entityBrowserEmbedMdxRule
} from './EntityBrowserEmbedEditable';
import { EntityBrowserEmbedDashboardConfigForm } from './EntityBrowserEmbedDashboardConfigForm';
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
  config.viewConfigs !== null;

export const entityBrowserEmbedSpec = defineMdxComponent<
  EntityBrowserEmbedSlateElement,
  { config?: string },
  'block'
>({
  component: EntityBrowserEmbed,
  mode: 'block',
  allowedProps: ['config'],
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbListSearch,
    label: 'Entity browser',
    description: 'A fully configurable, live entity browser (arbitrary filters, sort, and views).',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace', 'project'],
    component: EntityBrowserEmbedWidget,
    isValidConfig: isEntityBrowserEmbedConfig,
    createDefaultConfig: () => ({
      q: '',
      conditions: [],
      sort: 'name',
      view: 'table',
      viewConfigs: {}
    }),
    getTitle: () => 'Entity browser',
    configForm: EntityBrowserEmbedDashboardConfigForm,
    dialogWidth: 'min(1200px, 92vw)'
  },
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
