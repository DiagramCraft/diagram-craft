import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { SPEC_ITEMS_TABLE_TYPE, _specItemsTableSpecData } from './SpecItemsTableWidget';

const { icon, component, configForm, createDefaultProps, ...dashboardWidget } = _specItemsTableSpecData;
export default defineComponent({
  type: SPEC_ITEMS_TABLE_TYPE,
  category: 'data-views',
  name: 'Specification operations',
  description:
    'Operations and messages across the API specifications of every entity of a type, optionally only deprecated ones.',
  component: component!,
  configForm,
  createDefaultProps,
  icon,
  dashboardWidget
});
