import { TbAlertTriangle } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import {
  CaseConfigForm,
  DS_CASE_DEFAULTS,
  isCaseCountConfig
} from '../dataStewardshipWidgetSupport';
import { CaseCountWidget } from './CaseCountWidget';
export default defineComponent({
  type: 'data-stewardship-case-count',
  category: 'metrics',
  name: 'Case count',
  description: 'Number of open governance cases, filtered by scope and case kind.',
  component: CaseCountWidget,
  createDefaultProps: () => ({
    config: {
      ...DS_CASE_DEFAULTS,
      scope: 'mine',
      tone: 'none',
      subtextTemplate: '{due} due within a week',
      dueWithinDays: 7
    }
  }),
  configForm: CaseConfigForm,
  dashboardWidget: {
    icon: TbAlertTriangle,
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isCaseCountConfig,
  }
});
