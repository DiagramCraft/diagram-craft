import { TbListDetails } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RelatedEntitiesListConfigForm,
  RelatedEntitiesListWidget,
  relatedEntitiesListWidgetConfigSchema
} from './RelatedEntitiesListWidget';

export default defineComponent({
  type: 'RelatedEntitiesList',
  category: 'data-views',
  name: 'Related entities',
  description:
    'Entities of one type that reference a chosen entity, optionally with a progress bar per row.',
  icon: TbListDetails,
  component: RelatedEntitiesListWidget,
  configForm: RelatedEntitiesListConfigForm,
  configSchema: relatedEntitiesListWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 4,
    defaultH: 14,
    surfaces: ['workspace']
  }
});
