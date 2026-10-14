import { TbClipboardCheck } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  ASSESSMENT_COUNT_TYPE,
  AssessmentCountConfigForm,
  AssessmentCountWidget,
  AssessmentCountWidgetConfig
} from './AssessmentCountWidget';
import { isOptionalString } from '../../markdown/mdx-components/configGuards';

export default defineComponent({
  type: ASSESSMENT_COUNT_TYPE,
  category: 'metrics',
  name: 'Assessment count',
  description: 'Number of assessments by mode, entity type scope and due window.',
  icon: TbClipboardCheck,
  component: AssessmentCountWidget,
  createDefaultProps: () => ({ config: { mode: 'active' } }),
  configForm: AssessmentCountConfigForm,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: (config): config is AssessmentCountWidgetConfig =>
      (config.mode === 'active' ||
        config.mode === 'upcoming' ||
        config.mode === 'overdue' ||
        config.mode === 'all') &&
      isOptionalString(config.assessmentTypeId) &&
      (config.schemaNames === undefined ||
        (Array.isArray(config.schemaNames) &&
          config.schemaNames.every(name => typeof name === 'string'))) &&
      (config.dueWithinDays === undefined || typeof config.dueWithinDays === 'number') &&
      isOptionalString(config.subtext)
  }
});
