import { TbListDetails } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { RelatedEntitiesListConfigForm } from './RelatedEntitiesListConfigForm';
import {
  isRelatedEntitiesListConfigComplete,
  isRelatedEntitiesListConfigValid,
  RelatedEntitiesListWidget,
  type RelatedEntitiesListWidgetConfig
} from './RelatedEntitiesListWidget';

export const RELATED_ENTITIES_LIST_TYPE = 'RelatedEntitiesList' as const;

export const relatedEntitiesListSpec: DashboardWidgetSpec<RelatedEntitiesListWidgetConfig> = {
  icon: TbListDetails,
  label: 'Related entities',
  description:
    'Entities of one type that reference a chosen entity, optionally with a progress bar per row.',
  defaultW: 4,
  defaultH: 14,
  surfaces: ['workspace'],
  component: RelatedEntitiesListWidget,
  isValidConfig: (config): config is RelatedEntitiesListWidgetConfig =>
    isRelatedEntitiesListConfigValid(config) &&
    isRelatedEntitiesListConfigComplete(config as RelatedEntitiesListWidgetConfig),
  createDefaultConfig: () => ({ schemaName: '', referenceField: '' }),
  getTitle: config => config.label?.trim() || 'Related entities',
  configForm: RelatedEntitiesListConfigForm
};
