import { TbId } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { flatConfigCodec } from '../../configSchema';
import { configBlockMdx } from '../configBlock';
import { EntityCard } from './EntityCard';
import { EntityCardConfigForm } from './EntityCardConfigForm';
import { entityCardWidgetConfigSchema } from './types';

export default defineComponent({
  type: 'EntityCard',
  category: 'data-views',
  name: 'Entity card',
  description:
    'A summary card for one entity with its key fields. Use it to spotlight a single system or owner.',
  configSchema: entityCardWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project']
  },
  keywords: ['entity', 'card', 'catalog', 'service'],
  component: EntityCard,
  configForm: EntityCardConfigForm,
  icon: TbId,
  mdxComponent: configBlockMdx({
    codec: flatConfigCodec(entityCardWidgetConfigSchema, { attributeNames: { entityId: 'id' } }),
    placeholder: 'Choose entity…'
  })
});
