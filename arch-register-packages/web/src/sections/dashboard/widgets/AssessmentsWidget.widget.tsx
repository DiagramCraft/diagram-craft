import { TbClipboardCheck } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  AssessmentsConfigForm,
  AssessmentsWidget,
  assessmentsWidgetConfigSchema
} from './AssessmentsWidget';
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
