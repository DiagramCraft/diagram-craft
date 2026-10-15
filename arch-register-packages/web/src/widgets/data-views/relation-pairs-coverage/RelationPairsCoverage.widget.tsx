import { TbArrowsJoin } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { RelationPairsCoverageConfigForm } from './RelationPairsCoverageConfigForm';
import { RelationPairsCoverageWidget } from './RelationPairsCoverage';
import { relationPairsCoverageWidgetConfigSchema } from './types';

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
