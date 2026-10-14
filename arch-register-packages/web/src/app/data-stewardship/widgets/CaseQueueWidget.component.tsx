import { TbClipboardCheck } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { CaseConfigForm, caseConfigSchema } from '../dataStewardshipWidgetSupport';
import { CaseQueueHeaderActions, CaseQueueWidget } from './CaseQueueWidget';
export default defineComponent({
  type: 'data-stewardship-case-queue',
  category: 'data-views',
  name: 'Case queue',
  description: 'Open governance cases, oldest deadline first, with derived priority.',
  icon: TbClipboardCheck,
  component: CaseQueueWidget,
  configForm: CaseConfigForm,
  configSchema: caseConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 22,
    surfaces: ['workspace'],
    headerActionsComponent: CaseQueueHeaderActions,
    frame: { padded: false, showIcon: false }
  }
});
