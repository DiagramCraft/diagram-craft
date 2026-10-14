import { TbLayoutDashboard } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { flatConfigCodec } from '../../configSchema';
import { configBlockMdx } from '../configBlock';
import { EntityViewEmbed } from './EntityViewEmbed';
import { EntityViewEmbedConfigForm } from './EntityViewEmbedConfigForm';
import { savedViewEmbedWidgetConfigSchema } from './types';

export default defineComponent({
  type: 'EntityViewEmbed',
  category: 'data-views',
  name: 'Saved view',
  description: 'A live copy of a saved entity view. Use it to reuse a view someone already set up.',
  configSchema: savedViewEmbedWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project']
  },
  component: EntityViewEmbed,
  defaultConfig: context => ({ viewId: context.viewId ?? '' }),
  configForm: EntityViewEmbedConfigForm,
  icon: TbLayoutDashboard,
  mdxComponent: configBlockMdx({
    type: 'EntityViewEmbed',
    codec: flatConfigCodec(savedViewEmbedWidgetConfigSchema),
    placeholder: 'Select a saved view…',
    fullWidth: true,
    keywords: ['entity', 'view', 'embed', 'saved', 'catalog']
  })
});
