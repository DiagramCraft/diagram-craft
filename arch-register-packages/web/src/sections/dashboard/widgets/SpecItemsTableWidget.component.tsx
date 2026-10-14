import { TbListDetails } from 'react-icons/tb';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  SPEC_ITEMS_TABLE_TYPE,
  SpecItemsTableConfigForm,
  SpecItemsTableWidget,
  specItemsTableWidgetConfigSchema
} from './SpecItemsTableWidget';

export default defineComponent({
  type: SPEC_ITEMS_TABLE_TYPE,
  category: 'data-views',
  name: 'Specification operations',
  description:
    'Operations and messages across the API specifications of every entity of a type, optionally only deprecated ones.',
  icon: TbListDetails,
  component: SpecItemsTableWidget,
  createDefaultProps: () => ({ config: { schemaName: '' } }),
  configForm: SpecItemsTableConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false },
    isValidConfig: schemaGuard(specItemsTableWidgetConfigSchema)
  }
});
