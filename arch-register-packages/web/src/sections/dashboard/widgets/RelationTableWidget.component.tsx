import { TbTable } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RELATION_TABLE_TYPE,
  RelationTableConfigForm,
  RelationTableWidget,
  isValidConfig
} from './RelationTableWidget';

export default defineComponent({
  type: RELATION_TABLE_TYPE,
  category: 'data-views',
  name: 'Relation table',
  description: 'Instances of a relation type, with a chosen set of columns and an optional filter.',
  icon: TbTable,
  component: RelationTableWidget,
  createDefaultProps: () => ({ config: { relationSchemaName: '', fieldIds: [], limit: 100 } }),
  configForm: RelationTableConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false },
    isValidConfig,
    getTitle: config => config.relationSchemaName || 'Relation table'
  }
});
