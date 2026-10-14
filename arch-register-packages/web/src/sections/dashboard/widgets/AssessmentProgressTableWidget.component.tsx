import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENT_PROGRESS_TABLE_TYPE,
  _assessmentProgressTableSpecData
} from './AssessmentProgressTableWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _assessmentProgressTableSpecData;
export default defineComponent({
  type: ASSESSMENT_PROGRESS_TABLE_TYPE,
  category: 'data-views',
  name: 'Assessment progress',
  description: 'Assessments on an entity type with progress, due date and status.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
