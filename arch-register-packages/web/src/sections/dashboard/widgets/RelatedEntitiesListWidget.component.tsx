import { TbListDetails } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RELATED_ENTITIES_LIST_TYPE,
  RelatedEntitiesListConfigForm,
  RelatedEntitiesListWidget,
  relatedEntitiesListWidgetConfigSchema
} from './RelatedEntitiesListWidget';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';

export default defineComponent({
  type: RELATED_ENTITIES_LIST_TYPE,
  category: 'data-views',
  name: 'Related entities',
  description:
    'Entities of one type that reference a chosen entity, optionally with a progress bar per row.',
  icon: TbListDetails,
  component: RelatedEntitiesListWidget,
  createDefaultProps: () => ({ config: { schemaName: '', referenceField: '' } }),
  configForm: RelatedEntitiesListConfigForm,
  dashboardWidget: {
    defaultW: 4,
    defaultH: 14,
    surfaces: ['workspace'],
    isValidConfig: schemaGuard(relatedEntitiesListWidgetConfigSchema)
  }
});
