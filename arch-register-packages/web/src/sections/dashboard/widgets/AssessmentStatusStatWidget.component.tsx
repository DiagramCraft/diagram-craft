import { TbChecklist } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENT_STATUS_STAT_TYPE,
  AssessmentStatusStatWidget,
  ConfigForm,
  assessmentStatusStatConfigSchema
} from './AssessmentStatusStatWidget';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';

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
    isValidConfig: schemaGuard(assessmentStatusStatConfigSchema)
  }
});
