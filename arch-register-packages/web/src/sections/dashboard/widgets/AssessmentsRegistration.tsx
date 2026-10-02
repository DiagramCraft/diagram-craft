import type { TElement } from 'platejs';
import { TbClipboardCheck } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { AssessmentsConfigForm } from './AssessmentsConfigForm';
import { AssessmentsWidget, type AssessmentsWidgetConfig } from './AssessmentsWidget';

export const ASSESSMENTS_TYPE = 'Assessments' as const;

interface AssessmentsSlateElement extends TElement {}

export const assessmentsSpec = defineMdxComponent<
  AssessmentsSlateElement,
  { config: AssessmentsWidgetConfig },
  'block'
>({
  component: AssessmentsWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbClipboardCheck,
    label: 'Assessments',
    description: 'Open or all assessments filtered by mode, assessment type and entity type scope.',
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
      (config.relativeDue === undefined || typeof config.relativeDue === 'boolean') &&
      (config.label === undefined || typeof config.label === 'string'),
    createDefaultConfig: () => ({ mode: 'active' }),
    getTitle: (config: AssessmentsWidgetConfig) => {
      const label = config.label?.trim();
      return label === '' || label === undefined ? 'Assessments' : label;
    },
    configForm: AssessmentsConfigForm
  }
});
