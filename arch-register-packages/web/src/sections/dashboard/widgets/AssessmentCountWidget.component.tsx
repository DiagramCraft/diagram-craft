import { TbClipboardCheck } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENT_COUNT_TYPE,
  AssessmentCountConfigForm,
  AssessmentCountWidget,
  assessmentCountWidgetConfigSchema
} from './AssessmentCountWidget';

export default defineComponent({
  type: ASSESSMENT_COUNT_TYPE,
  category: 'metrics',
  name: 'Assessment count',
  description: 'Number of assessments by mode, entity type scope and due window.',
  icon: TbClipboardCheck,
  component: AssessmentCountWidget,
  configForm: AssessmentCountConfigForm,
  configSchema: assessmentCountWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
