import { TbChecklist } from 'react-icons/tb';
import { AssessmentSchemaConfigForm } from './AssessmentSchemaConfigForm';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENT_PROGRESS_TABLE_TYPE,
  AssessmentProgressTableWidget,
  assessmentProgressTableConfigSchema
} from './AssessmentProgressTableWidget';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';

export default defineComponent({
  type: ASSESSMENT_PROGRESS_TABLE_TYPE,
  category: 'data-views',
  name: 'Assessment progress',
  description: 'Assessments on an entity type with progress, due date and status.',
  icon: TbChecklist,
  component: AssessmentProgressTableWidget,
  createDefaultProps: () => ({ config: { schemaName: '' } }),
  configForm: props => <AssessmentSchemaConfigForm {...props} statusRequired={false} />,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 20,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: schemaGuard(assessmentProgressTableConfigSchema)
  }
});
