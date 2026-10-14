import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { RELATION_TABLE_TYPE, _relationTableSpecData } from './RelationTableWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _relationTableSpecData;
export default defineComponent({
  type: RELATION_TABLE_TYPE,
  category: 'data-views',
  name: 'Relation table',
  description: 'Instances of a relation type, with a chosen set of columns and an optional filter.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
