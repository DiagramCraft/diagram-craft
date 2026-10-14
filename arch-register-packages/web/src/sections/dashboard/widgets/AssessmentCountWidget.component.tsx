import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { ASSESSMENT_COUNT_TYPE, _assessmentCountSpecData } from './AssessmentCountWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _assessmentCountSpecData;
export default defineComponent({
  type: ASSESSMENT_COUNT_TYPE,
  category: 'metrics',
  name: 'Assessment count',
  description: 'Number of assessments by mode, entity type scope and due window.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
