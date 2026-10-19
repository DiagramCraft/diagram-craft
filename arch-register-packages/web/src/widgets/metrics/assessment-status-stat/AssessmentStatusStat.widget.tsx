import { TbChecklist } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { AssessmentStatusStatWidget } from './AssessmentStatusStat';
import { ConfigForm } from './AssessmentStatusStatConfigForm';
import { assessmentStatusStatConfigSchema } from './types';

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
    frame: { padded: false, showIcon: false }
  }
});
