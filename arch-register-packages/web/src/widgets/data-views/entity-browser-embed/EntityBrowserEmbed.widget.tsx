import { TbListSearch } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { configBlockMdx } from '../../shared/mdx/configBlock';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import { entityBrowserEmbedCodec, entityBrowserEmbedConfigSchema } from './EntityBrowserEmbedCodec';
import { EntityBrowserEmbedConfigForm } from './EntityBrowserEmbedConfigForm';

export default defineWidget({
  type: 'EntityBrowserEmbed',
  category: 'data-views',
  name: 'Entity browser',
  description:
    'A live, searchable list of entities with your own filters, sorting and columns. Use it for a flexible catalog view.',
  configSchema: entityBrowserEmbedConfigSchema,
  // Inside a project the browser starts scoped to it; elsewhere `projectScope` stays unset.
  defaultConfig: context => (context.projectId ? { projectScope: 'project' } : {}),
  dashboard: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project']
  },
  configDialog: { width: 'min(1200px, 92vw)' },
  keywords: ['entity', 'browser', 'embed', 'search', 'filter', 'catalog'],
  component: EntityBrowserEmbed,
  configForm: EntityBrowserEmbedConfigForm,
  icon: TbListSearch,
  mdx: configBlockMdx({
    codec: entityBrowserEmbedCodec.codec,
    placeholder: 'Configure an entity browser…',
    fullWidth: true
  })
});
