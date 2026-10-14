import { TbTable } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  GROUPED_ROLLUP_TABLE_TYPE,
  GroupedRollupTableConfigForm,
  GroupedRollupTableWidget,
  groupedRollupTableWidgetConfigSchema
} from './GroupedRollupTableWidget';

export default defineComponent({
  type: GROUPED_ROLLUP_TABLE_TYPE,
  category: 'data-views',
  name: 'Roll-up table',
  description:
    'Records summed into ranked rows, per record or grouped by a field, with optional bars, share and count.',
  icon: TbTable,
  component: GroupedRollupTableWidget,
  createDefaultProps: () => ({ config: { query: '', valueFieldId: '' } }),
  configForm: GroupedRollupTableConfigForm,
  configSchema: groupedRollupTableWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace', 'project'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
