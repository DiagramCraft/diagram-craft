import { TbClipboardCheck } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import {
  AssessmentCountConfigForm,
  AssessmentCountWidget,
  assessmentCountWidgetConfigSchema
} from './AssessmentCount';

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
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
