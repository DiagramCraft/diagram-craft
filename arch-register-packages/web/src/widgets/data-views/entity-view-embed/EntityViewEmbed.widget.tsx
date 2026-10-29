import { TbLayoutDashboard } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { flatConfigCodec } from '../../shared/configSchema';
import { configBlockMdx } from '../../shared/mdx/configBlock';
import { EntityViewEmbed } from './EntityViewEmbed';
import { EntityViewEmbedConfigForm } from './EntityViewEmbedConfigForm';
import { savedViewEmbedWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'EntityViewEmbed',
  category: 'data-views',
  name: 'Saved view',
  description: 'A live copy of a saved entity view. Use it to reuse a view someone already set up.',
  configSchema: savedViewEmbedWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project']
  },
  keywords: ['entity', 'view', 'embed', 'saved', 'catalog'],
  component: EntityViewEmbed,
  defaultConfig: context => ({ viewId: context.viewId ?? '' }),
  configForm: EntityViewEmbedConfigForm,
  icon: TbLayoutDashboard,
  mdx: configBlockMdx({
    codec: flatConfigCodec(savedViewEmbedWidgetConfigSchema),
    placeholder: 'Select a saved view…',
    fullWidth: true
  })
});
