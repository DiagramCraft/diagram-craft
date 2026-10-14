import { TbListSearch } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { configBlockMdx } from '../configBlock';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import { entityBrowserEmbedCodec, entityBrowserEmbedConfigSchema } from './EntityBrowserEmbedCodec';
import { EntityBrowserEmbedConfigForm } from './EntityBrowserEmbedConfigForm';

export default defineComponent({
  type: 'EntityBrowserEmbed',
  category: 'data-views',
  name: 'Entity browser',
  description:
    'A live, searchable list of entities with your own filters, sorting and columns. Use it for a flexible catalog view.',
  configSchema: entityBrowserEmbedConfigSchema,
  // Inside a project the browser starts scoped to it; elsewhere `projectScope` stays unset.
  defaultConfig: context => (context.projectId ? { projectScope: 'project' } : {}),
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project']
  },
  configDialog: { width: 'min(1200px, 92vw)' },
  component: EntityBrowserEmbed,
  configForm: EntityBrowserEmbedConfigForm,
  icon: TbListSearch,
  mdxComponent: configBlockMdx({
    type: 'EntityBrowserEmbed',
    codec: entityBrowserEmbedCodec.codec,
    placeholder: 'Configure an entity browser…',
    fullWidth: true,
    keywords: ['entity', 'browser', 'embed', 'search', 'filter', 'catalog']
  })
});
