import { TbArrowsJoin } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  RelationPairsCoverageConfigForm,
  RelationPairsCoverageWidget,
  relationPairsCoverageWidgetConfigSchema
} from './RelationPairsCoverageWidget';

export default defineWidget({
  type: 'RelationPairsCoverage',
  category: 'data-views',
  name: 'Pair coverage',
  description:
    'Every provider × consumer pair around a shared entity, and whether a chosen relation type connects the two.',
  icon: TbArrowsJoin,
  component: RelationPairsCoverageWidget,
  configForm: RelationPairsCoverageConfigForm,
  configSchema: relationPairsCoverageWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false }
  }
});
