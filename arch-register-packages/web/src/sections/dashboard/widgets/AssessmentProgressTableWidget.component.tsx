import { TbChecklist } from 'react-icons/tb';
import { isAssessmentStatus } from './assessmentSummaryLogic';
import { AssessmentSchemaConfigForm } from './AssessmentSchemaConfigForm';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENT_PROGRESS_TABLE_TYPE,
  AssessmentProgressTableConfig,
  AssessmentProgressTableWidget
} from './AssessmentProgressTableWidget';

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
    isValidConfig: (config): config is AssessmentProgressTableConfig =>
      typeof config.schemaName === 'string' &&
      config.schemaName.length > 0 &&
      (config.status === undefined || isAssessmentStatus(config.status))
  }
});
