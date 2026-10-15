import { TbChartDonut } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { flatConfigCodec } from '../../shared/configSchema';
import { configBlockMdx } from '../../shared/mdx/configBlock';
import { EntityChart } from './EntityChart';
import { EntityChartConfigForm } from './EntityChartConfigForm';
import { entityChartWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'EntityChart',
  category: 'visualizations',
  name: 'Entity chart',
  description:
    'A live chart of entities grouped by a field. Use it to show distribution, e.g. by lifecycle or owner.',
  configSchema: entityChartWidgetConfigSchema,
  keywords: ['entity', 'chart', 'donut', 'bar', 'graph', 'visualize', 'analytics'],
  component: EntityChart,
  configForm: EntityChartConfigForm,
  icon: TbChartDonut,
  dashboard: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace']
  },
  mdx: configBlockMdx({
    codec: flatConfigCodec(entityChartWidgetConfigSchema),
    placeholder: 'Configure entity chart…'
  })
});
