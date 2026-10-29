import { TbClipboardCheck } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { AssessmentCountConfigForm } from './AssessmentCountConfigForm';
import { AssessmentCountWidget } from './AssessmentCount';
import { assessmentCountWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'AssessmentCount',
  category: 'metrics',
  name: 'Assessment count',
  description: 'Number of assessments by mode, entity type scope and due window.',
  icon: TbClipboardCheck,
  component: AssessmentCountWidget,
  configForm: AssessmentCountConfigForm,
  configSchema: assessmentCountWidgetConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false }
  }
});
