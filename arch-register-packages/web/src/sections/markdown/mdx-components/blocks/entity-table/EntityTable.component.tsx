import { TbTable } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { flatConfigCodec } from '../../configSchema';
import { configBlockMdx } from '../configBlock';
import { EntityTable } from './EntityTable';
import { EntityTableConfigForm } from './EntityTableConfigForm';
import { entityTableWidgetConfigSchema } from './types';

export default defineComponent({
  type: 'EntityTable',
  category: 'data-views',
  name: 'Entity table',
  description:
    'A table of entities matching filters you define. Use it for a fixed, readable list.',
  configSchema: entityTableWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project']
  },
  component: EntityTable,
  configForm: EntityTableConfigForm,
  icon: TbTable,
  mdxComponent: configBlockMdx({
    codec: flatConfigCodec(entityTableWidgetConfigSchema),
    placeholder: 'Configure entity table…',
    fullWidth: true,
    keywords: ['entity', 'table', 'catalog', 'list', 'filter']
  })
});
