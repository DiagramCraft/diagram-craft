import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RELATED_ENTITIES_LIST_TYPE,
  _relatedEntitiesListSpecData
} from './RelatedEntitiesListWidget';
export default defineComponent({
  type: RELATED_ENTITIES_LIST_TYPE,
  category: 'data-views',
  name: 'Related entities',
  description:
    'Entities of one type that reference a chosen entity, optionally with a progress bar per row.',
  dashboardWidget: _relatedEntitiesListSpecData
});
