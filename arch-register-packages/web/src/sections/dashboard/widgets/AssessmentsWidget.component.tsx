import { TbClipboardCheck } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  AssessmentsConfigForm,
  AssessmentsWidget,
  assessmentsWidgetConfigSchema
} from './AssessmentsWidget';
export default defineComponent({
  type: 'Assessments',
  category: 'metrics',
  name: 'Assessments',
  description: 'Open or all assessments filtered by mode, assessment type and entity type scope.',
  icon: TbClipboardCheck,
  component: AssessmentsWidget,
  configForm: AssessmentsConfigForm,
  configSchema: assessmentsWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 12,
    surfaces: ['workspace', 'project']
  }
});
