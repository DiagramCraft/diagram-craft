import { TbTable } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  GROUPED_ROLLUP_TABLE_TYPE,
  GroupedRollupTableConfigForm,
  GroupedRollupTableWidget,
  GroupedRollupTableWidgetConfig,
  isGroupedRollupTableConfigComplete
} from './GroupedRollupTableWidget';
import { isOptionalBoolean, isOptionalString } from '../../markdown/mdx-components/configGuards';

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
  dashboardWidget: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace', 'project'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: (config): config is GroupedRollupTableWidgetConfig =>
      typeof config.valueFieldId === 'string' &&
      isOptionalString(config.query) &&
      isOptionalString(config.schemaName) &&
      isOptionalString(config.groupFieldId) &&
      isOptionalString(config.groupLabel) &&
      isOptionalString(config.valueLabel) &&
      isOptionalBoolean(config.showBar) &&
      isOptionalBoolean(config.showPercent) &&
      isOptionalBoolean(config.showCount) &&
      isOptionalBoolean(config.showTotal) &&
      (config.limit === undefined || (typeof config.limit === 'number' && config.limit > 0)) &&
      isGroupedRollupTableConfigComplete(config as GroupedRollupTableWidgetConfig)
  }
});
