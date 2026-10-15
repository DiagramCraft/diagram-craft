import { TbClipboardCheck } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { AssessmentsConfigForm } from './AssessmentsConfigForm';
import { AssessmentsWidget } from './Assessments';
import { assessmentsWidgetConfigSchema } from './types';
export default defineWidget({
  type: 'Assessments',
  category: 'metrics',
  name: 'Assessments',
  description: 'Open or all assessments filtered by mode, assessment type and entity type scope.',
  icon: TbClipboardCheck,
  component: AssessmentsWidget,
  configForm: AssessmentsConfigForm,
  configSchema: assessmentsWidgetConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 12,
    surfaces: ['workspace', 'project']
  }
});
