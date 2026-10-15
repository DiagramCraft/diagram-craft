import { TbTable } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { RelationTableConfigForm } from './RelationTableConfigForm';
import { RelationTableWidget } from './RelationTable';
import { relationTableWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'RelationTable',
  category: 'data-views',
  name: 'Relation table',
  description: 'Instances of a relation type, with a chosen set of columns and an optional filter.',
  icon: TbTable,
  component: RelationTableWidget,
  configForm: RelationTableConfigForm,
  configSchema: relationTableWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false },
    getTitle: config => config.relationSchemaName || 'Relation table'
  }
});
