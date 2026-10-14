import { TbChartBar } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RATIO_BAR_LIST_TYPE,
  RatioBarListConfigForm,
  RatioBarListWidget,
  ratioBarListWidgetConfigSchema
} from './RatioBarListWidget';

export default defineComponent({
  type: RATIO_BAR_LIST_TYPE,
  category: 'metrics',
  name: 'Ratio bars',
  description: 'One coverage bar per value of a field, filled by the share matching a field value.',
  icon: TbChartBar,
  component: RatioBarListWidget,
  createDefaultProps: () => ({
    config: {
      schemaName: '',
      groupByFieldId: '',
      numeratorFieldId: '',
      numeratorValue: ''
    }
  }),
  configForm: RatioBarListConfigForm,
  configSchema: ratioBarListWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace']
  }
});
