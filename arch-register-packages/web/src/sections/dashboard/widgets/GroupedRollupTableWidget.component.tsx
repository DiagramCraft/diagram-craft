import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { GROUPED_ROLLUP_TABLE_TYPE, _groupedRollupTableSpecData } from './GroupedRollupTableWidget';
export default defineComponent({
  type: GROUPED_ROLLUP_TABLE_TYPE,
  category: 'data-views',
  name: 'Roll-up table',
  description:
    'Records summed into ranked rows, per record or grouped by a field, with optional bars, share and count.',
  dashboardWidget: _groupedRollupTableSpecData
});
