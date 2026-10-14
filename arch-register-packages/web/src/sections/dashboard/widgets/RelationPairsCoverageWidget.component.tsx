import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  RELATION_PAIRS_COVERAGE_TYPE,
  _relationPairsCoverageSpecData
} from './RelationPairsCoverageWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _relationPairsCoverageSpecData;
export default defineComponent({
  type: RELATION_PAIRS_COVERAGE_TYPE,
  category: 'data-views',
  name: 'Pair coverage',
  description:
    'Every provider × consumer pair around a shared entity, and whether a chosen relation type connects the two.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
