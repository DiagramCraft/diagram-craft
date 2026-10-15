import { TbChecklist } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  AssessmentStatusStatWidget,
  ConfigForm,
  assessmentStatusStatConfigSchema
} from './AssessmentStatusStatWidget';

export default defineWidget({
  type: 'AssessmentStatusStat',
  category: 'metrics',
  name: 'Assessment status',
  description:
    'Number of assessments on an entity type that are overdue, in progress, not started or complete.',
  icon: TbChecklist,
  component: AssessmentStatusStatWidget,
  configForm: ConfigForm,
  configSchema: assessmentStatusStatConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
