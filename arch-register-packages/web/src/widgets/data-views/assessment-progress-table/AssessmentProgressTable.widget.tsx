import { TbChecklist } from 'react-icons/tb';
import { AssessmentSchemaConfigForm } from '../../shared/data/AssessmentSchemaConfigForm';
import { defineWidget } from '../../shared/defineWidget';
import {
  AssessmentProgressTableWidget,
  assessmentProgressTableConfigSchema
} from './AssessmentProgressTable';

export default defineWidget({
  type: 'AssessmentProgressTable',
  category: 'data-views',
  name: 'Assessment progress',
  description: 'Assessments on an entity type with progress, due date and status.',
  icon: TbChecklist,
  component: AssessmentProgressTableWidget,
  configForm: props => <AssessmentSchemaConfigForm {...props} statusRequired={false} />,
  configSchema: assessmentProgressTableConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
