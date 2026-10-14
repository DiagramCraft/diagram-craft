import { TbTable } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RELATION_TABLE_TYPE,
  RelationTableConfigForm,
  RelationTableWidget,
  relationTableWidgetConfigSchema
} from './RelationTableWidget';

export default defineComponent({
  type: RELATION_TABLE_TYPE,
  category: 'data-views',
  name: 'Relation table',
  description: 'Instances of a relation type, with a chosen set of columns and an optional filter.',
  icon: TbTable,
  component: RelationTableWidget,
  configForm: RelationTableConfigForm,
  configSchema: relationTableWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false },
    getTitle: config => config.relationSchemaName || 'Relation table'
  }
});
