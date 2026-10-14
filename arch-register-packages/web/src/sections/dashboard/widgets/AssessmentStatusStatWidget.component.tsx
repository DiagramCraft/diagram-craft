import { TbChecklist } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  AssessmentStatusStatWidget,
  ConfigForm,
  assessmentStatusStatConfigSchema
} from './AssessmentStatusStatWidget';

export default defineComponent({
  type: 'AssessmentStatusStat',
  category: 'metrics',
  name: 'Assessment status',
  description:
    'Number of assessments on an entity type that are overdue, in progress, not started or complete.',
  icon: TbChecklist,
  component: AssessmentStatusStatWidget,
  configForm: ConfigForm,
  configSchema: assessmentStatusStatConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
