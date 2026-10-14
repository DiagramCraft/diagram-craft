import { TbAlertTriangle } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { CaseConfigForm, caseCountConfigSchema } from '../dataStewardshipWidgetSupport';
import { CaseCountWidget } from './CaseCountWidget';
export default defineComponent({
  type: 'data-stewardship-case-count',
  category: 'metrics',
  name: 'Case count',
  description: 'Number of open governance cases, filtered by scope and case kind.',
  icon: TbAlertTriangle,
  component: CaseCountWidget,
  configForm: CaseConfigForm,
  configSchema: caseCountConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
