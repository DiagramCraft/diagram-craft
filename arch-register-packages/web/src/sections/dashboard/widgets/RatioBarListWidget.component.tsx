import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { RATIO_BAR_LIST_TYPE, _ratioBarListSpecData } from './RatioBarListWidget';
export default defineComponent({
  type: RATIO_BAR_LIST_TYPE,
  category: 'metrics',
  name: 'Ratio bars',
  description: 'One coverage bar per value of a field, filled by the share matching a field value.',
  dashboardWidget: _ratioBarListSpecData
});
