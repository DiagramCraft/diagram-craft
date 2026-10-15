import { TbTable } from 'react-icons/tb';
import { defineWidget } from '../../defineWidget';
import { flatConfigCodec } from '../../configSchema';
import { configBlockMdx } from '../configBlock';
import { EntityTable } from './EntityTable';
import { EntityTableConfigForm } from './EntityTableConfigForm';
import { entityTableWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'EntityTable',
  category: 'data-views',
  name: 'Entity table',
  description:
    'A table of entities matching filters you define. Use it for a fixed, readable list.',
  configSchema: entityTableWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project']
  },
  keywords: ['entity', 'table', 'catalog', 'list', 'filter'],
  component: EntityTable,
  configForm: EntityTableConfigForm,
  icon: TbTable,
  mdx: configBlockMdx({
    codec: flatConfigCodec(entityTableWidgetConfigSchema),
    placeholder: 'Configure entity table…',
    fullWidth: true
  })
});
