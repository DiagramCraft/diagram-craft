import { TbCalendarEvent } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { CaseConfigForm, DS_CASE_DEFAULTS, isCaseConfig } from '../dataStewardshipWidgetSupport';
import { CaseCalendarHeaderActions, CaseCalendarWidget } from './CaseCalendarWidget';
export default defineComponent({
  type: 'data-stewardship-case-calendar',
  category: 'visualizations',
  name: 'Next six weeks',
  description: 'Open governance cases bucketed by due week.',
  component: CaseCalendarWidget,
  createDefaultProps: () => ({ config: { ...DS_CASE_DEFAULTS, scope: 'mine' } }),
  configForm: CaseConfigForm,
  dashboardWidget: {
    icon: TbCalendarEvent,
    defaultW: 12,
    defaultH: 14,
    surfaces: ['workspace'],
    headerActionsComponent: CaseCalendarHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: isCaseConfig
  }
});
