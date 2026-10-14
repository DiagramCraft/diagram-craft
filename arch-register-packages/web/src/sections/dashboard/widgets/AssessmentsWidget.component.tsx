import { TbClipboardCheck } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import type { AssessmentsWidgetConfig } from './AssessmentsWidget';
import { ASSESSMENTS_TYPE, AssessmentsConfigForm, AssessmentsWidget } from './AssessmentsWidget';
export default defineComponent({
  type: ASSESSMENTS_TYPE,
  category: 'metrics',
  name: 'Assessments',
  description: 'Open or all assessments filtered by mode, assessment type and entity type scope.',
  dashboardWidget: {
    icon: TbClipboardCheck,
    defaultW: 3,
    defaultH: 12,
    surfaces: ['workspace', 'project'],
    component: AssessmentsWidget,
    isValidConfig: (config): config is AssessmentsWidgetConfig =>
      (config.mode === 'active' ||
        config.mode === 'upcoming' ||
        config.mode === 'overdue' ||
        config.mode === 'all') &&
      (config.assessmentTypeId === undefined || typeof config.assessmentTypeId === 'string') &&
      (config.schemaNames === undefined ||
        (Array.isArray(config.schemaNames) &&
          config.schemaNames.every(name => typeof name === 'string'))) &&
      (config.relativeDue === undefined || typeof config.relativeDue === 'boolean'),
    createDefaultConfig: () => ({ mode: 'active' }),
    configForm: AssessmentsConfigForm
  }
});
