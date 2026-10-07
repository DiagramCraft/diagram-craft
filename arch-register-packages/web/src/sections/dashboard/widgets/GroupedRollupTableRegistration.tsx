import { TbTable } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { GroupedRollupTableConfigForm } from './GroupedRollupTableConfigForm';
import {
  GroupedRollupTableWidget,
  isGroupedRollupTableConfigComplete,
  type GroupedRollupTableWidgetConfig
} from './GroupedRollupTableWidget';

export const GROUPED_ROLLUP_TABLE_TYPE = 'GroupedRollupTable' as const;

const optionalBoolean = (value: unknown): boolean =>
  value === undefined || typeof value === 'boolean';

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

export const groupedRollupTableSpec: DashboardWidgetSpec<GroupedRollupTableWidgetConfig> = {
  icon: TbTable,
  label: 'Roll-up table',
  description:
    'Records summed into ranked rows, per record or grouped by a field, with optional bars, share and count.',
  defaultW: 12,
  defaultH: 20,
  surfaces: ['workspace', 'project'],
  component: GroupedRollupTableWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is GroupedRollupTableWidgetConfig =>
    typeof config.valueFieldId === 'string' &&
    optionalString(config.query) &&
    optionalString(config.schemaName) &&
    optionalString(config.groupFieldId) &&
    optionalString(config.groupLabel) &&
    optionalString(config.valueLabel) &&
    optionalString(config.label) &&
    optionalBoolean(config.showBar) &&
    optionalBoolean(config.showPercent) &&
    optionalBoolean(config.showCount) &&
    optionalBoolean(config.showTotal) &&
    (config.limit === undefined || (typeof config.limit === 'number' && config.limit > 0)) &&
    isGroupedRollupTableConfigComplete(config as GroupedRollupTableWidgetConfig),
  createDefaultConfig: () => ({ query: '', valueFieldId: '' }),
  getTitle: config => config.label?.trim() || 'Roll-up table',
  configForm: GroupedRollupTableConfigForm
};
