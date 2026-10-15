import { TbTable } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { GroupedRollupTableConfigForm } from './GroupedRollupTableConfigForm';
import { GroupedRollupTableWidget } from './GroupedRollupTable';
import { groupedRollupTableWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'GroupedRollupTable',
  category: 'data-views',
  name: 'Roll-up table',
  description:
    'Records summed into ranked rows, per record or grouped by a field, with optional bars, share and count.',
  icon: TbTable,
  component: GroupedRollupTableWidget,
  configForm: GroupedRollupTableConfigForm,
  configSchema: groupedRollupTableWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace', 'project'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
