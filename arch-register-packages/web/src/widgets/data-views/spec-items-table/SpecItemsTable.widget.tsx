import { TbListDetails } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { SpecItemsTableConfigForm } from './SpecItemsTableConfigForm';
import { SpecItemsTableWidget } from './SpecItemsTable';
import { specItemsTableWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'SpecItemsTable',
  category: 'data-views',
  name: 'Specification operations',
  description:
    'Operations and messages across the API specifications of every entity of a type, optionally only deprecated ones.',
  icon: TbListDetails,
  component: SpecItemsTableWidget,
  configForm: SpecItemsTableConfigForm,
  configSchema: specItemsTableWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false }
  }
});
