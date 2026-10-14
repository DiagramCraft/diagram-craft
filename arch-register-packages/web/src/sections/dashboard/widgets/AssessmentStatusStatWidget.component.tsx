import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENT_STATUS_STAT_TYPE,
  _assessmentStatusStatSpecData
} from './AssessmentStatusStatWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _assessmentStatusStatSpecData;
export default defineComponent({
  type: ASSESSMENT_STATUS_STAT_TYPE,
  category: 'metrics',
  name: 'Assessment status',
  description:
    'Number of assessments on an entity type that are overdue, in progress, not started or complete.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
