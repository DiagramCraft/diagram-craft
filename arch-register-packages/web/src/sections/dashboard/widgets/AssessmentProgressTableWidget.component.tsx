import { TbChecklist } from 'react-icons/tb';
import { AssessmentSchemaConfigForm } from './AssessmentSchemaConfigForm';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  AssessmentProgressTableWidget,
  assessmentProgressTableConfigSchema
} from './AssessmentProgressTableWidget';

export default defineComponent({
  type: 'AssessmentProgressTable',
  category: 'data-views',
  name: 'Assessment progress',
  description: 'Assessments on an entity type with progress, due date and status.',
  icon: TbChecklist,
  component: AssessmentProgressTableWidget,
  configForm: props => <AssessmentSchemaConfigForm {...props} statusRequired={false} />,
  configSchema: assessmentProgressTableConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
