import { TbArrowsJoin } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RELATION_PAIRS_COVERAGE_TYPE,
  RelationPairsCoverageConfigForm,
  RelationPairsCoverageWidget,
  relationPairsCoverageWidgetConfigSchema
} from './RelationPairsCoverageWidget';

export default defineComponent({
  type: RELATION_PAIRS_COVERAGE_TYPE,
  category: 'data-views',
  name: 'Pair coverage',
  description:
    'Every provider × consumer pair around a shared entity, and whether a chosen relation type connects the two.',
  icon: TbArrowsJoin,
  component: RelationPairsCoverageWidget,
  createDefaultProps: () => ({
    config: {
      hubSchemaName: '',
      providerFieldName: '',
      consumerFieldName: '',
      coverageRelationSchemaName: ''
    }
  }),
  configForm: RelationPairsCoverageConfigForm,
  configSchema: relationPairsCoverageWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false }
  }
});
