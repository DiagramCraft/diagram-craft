import { TbListDetails } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import {
  RelatedEntitiesListConfigForm,
  RelatedEntitiesListWidget,
  relatedEntitiesListWidgetConfigSchema
} from './RelatedEntitiesList';

export default defineWidget({
  type: 'RelatedEntitiesList',
  category: 'data-views',
  name: 'Related entities',
  description:
    'Entities of one type that reference a chosen entity, optionally with a progress bar per row.',
  icon: TbListDetails,
  component: RelatedEntitiesListWidget,
  configForm: RelatedEntitiesListConfigForm,
  configSchema: relatedEntitiesListWidgetConfigSchema,
  dashboard: {
    defaultW: 4,
    defaultH: 14,
    surfaces: ['workspace']
  }
});
