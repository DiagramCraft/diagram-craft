import { TbHistory } from 'react-icons/tb';
import { defineWidget } from '../../defineWidget';
import { flatConfigCodec } from '../../configSchema';
import { configBlockMdx } from '../configBlock';
import { EntityChangelog } from './EntityChangelog';
import { EntityChangelogConfigForm } from './EntityChangelogConfigForm';
import { entityChangelogWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'EntityChangelog',
  category: 'data-views',
  name: 'Entity changelog',
  description:
    'A feed of recent changes to one entity or a filtered set. Use it to see what changed lately.',
  configSchema: entityChangelogWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  },
  keywords: ['changelog', 'audit', 'history', 'changes', 'entity'],
  component: EntityChangelog,
  configForm: EntityChangelogConfigForm,
  icon: TbHistory,
  mdx: configBlockMdx({
    codec: flatConfigCodec(entityChangelogWidgetConfigSchema, {
      attributeNames: { entityId: 'id' }
    }),
    placeholder: 'Configure entity changelog…',
    fullWidth: true
  })
});
