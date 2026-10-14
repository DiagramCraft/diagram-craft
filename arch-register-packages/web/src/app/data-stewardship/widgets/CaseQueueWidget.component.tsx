import { TbClipboardCheck } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { CaseConfigForm, DS_CASE_DEFAULTS, isCaseConfig } from '../dataStewardshipWidgetSupport';
import { CaseQueueHeaderActions, CaseQueueWidget } from './CaseQueueWidget';
export default defineComponent({
  type: 'data-stewardship-case-queue',
  category: 'data-views',
  name: 'Case queue',
  description: 'Open governance cases, oldest deadline first, with derived priority.',
  component: CaseQueueWidget,
  createDefaultProps: () => ({ config: { ...DS_CASE_DEFAULTS, scope: 'mine' } }),
  configForm: CaseConfigForm,
  dashboardWidget: {
    icon: TbClipboardCheck,
    defaultW: 12,
    defaultH: 22,
    surfaces: ['workspace'],
    headerActionsComponent: CaseQueueHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: isCaseConfig
  }
});
