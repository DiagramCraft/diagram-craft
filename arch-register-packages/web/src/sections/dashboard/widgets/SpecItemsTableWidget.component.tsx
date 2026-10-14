import { TbListDetails } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  SpecItemsTableConfigForm,
  SpecItemsTableWidget,
  specItemsTableWidgetConfigSchema
} from './SpecItemsTableWidget';

export default defineComponent({
  type: 'SpecItemsTable',
  category: 'data-views',
  name: 'Specification operations',
  description:
    'Operations and messages across the API specifications of every entity of a type, optionally only deprecated ones.',
  icon: TbListDetails,
  component: SpecItemsTableWidget,
  configForm: SpecItemsTableConfigForm,
  configSchema: specItemsTableWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false }
  }
});
