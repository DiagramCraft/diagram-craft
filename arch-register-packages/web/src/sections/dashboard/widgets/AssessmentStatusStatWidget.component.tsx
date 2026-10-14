import { TbChecklist } from 'react-icons/tb';
import { isAssessmentStatus } from './assessmentSummaryLogic';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENT_STATUS_STAT_TYPE,
  AssessmentStatusStatConfig,
  AssessmentStatusStatWidget,
  ConfigForm
} from './AssessmentStatusStatWidget';

export default defineComponent({
  type: ASSESSMENT_STATUS_STAT_TYPE,
  category: 'metrics',
  name: 'Assessment status',
  description:
    'Number of assessments on an entity type that are overdue, in progress, not started or complete.',
  icon: TbChecklist,
  component: AssessmentStatusStatWidget,
  createDefaultProps: () => ({ config: { schemaName: '', status: 'overdue' } }),
  configForm: ConfigForm,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: (config): config is AssessmentStatusStatConfig =>
      typeof config.schemaName === 'string' &&
      config.schemaName.length > 0 &&
      isAssessmentStatus(config.status) &&
      (config.subtextTemplate === undefined || typeof config.subtextTemplate === 'string')
  }
});
