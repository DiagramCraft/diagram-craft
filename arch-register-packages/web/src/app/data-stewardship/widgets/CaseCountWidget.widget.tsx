import { TbAlertTriangle } from 'react-icons/tb';
import { defineWidget } from '../../../sections/markdown/mdx-components/defineWidget';
import { CaseConfigForm, caseCountConfigSchema } from '../dataStewardshipWidgetSupport';
import { CaseCountWidget } from './CaseCountWidget';
export default defineWidget({
  type: 'data-stewardship-case-count',
  category: 'metrics',
  name: 'Case count',
  description: 'Number of open governance cases, filtered by scope and case kind.',
  icon: TbAlertTriangle,
  component: CaseCountWidget,
  configForm: CaseConfigForm,
  configSchema: caseCountConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
