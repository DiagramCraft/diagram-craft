import { TbClipboardCheck } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENTS_TYPE,
  AssessmentsConfigForm,
  AssessmentsWidget,
  assessmentsWidgetConfigSchema
} from './AssessmentsWidget';
export default defineComponent({
  type: ASSESSMENTS_TYPE,
  category: 'metrics',
  name: 'Assessments',
  description: 'Open or all assessments filtered by mode, assessment type and entity type scope.',
  icon: TbClipboardCheck,
  component: AssessmentsWidget,
  createDefaultProps: () => ({ config: { mode: 'active' } }),
  configForm: AssessmentsConfigForm,
  configSchema: assessmentsWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 12,
    surfaces: ['workspace', 'project']
  }
});
