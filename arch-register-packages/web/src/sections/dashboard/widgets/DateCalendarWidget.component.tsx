import { TbCalendarMonth } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  DATE_CALENDAR_TYPE,
  DateCalendarConfigForm,
  DateCalendarWidget,
  dateCalendarWidgetConfigSchema
} from './DateCalendarWidget';

export default defineComponent({
  type: DATE_CALENDAR_TYPE,
  category: 'visualizations',
  name: 'Calendar',
  description:
    'Records placed on a month or week calendar by a date field, e.g. renewals or reviews.',
  icon: TbCalendarMonth,
  component: DateCalendarWidget,
  createDefaultProps: () => ({ config: { query: '', dateFieldId: '' } }),
  configForm: DateCalendarConfigForm,
  configSchema: dateCalendarWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 30,
    surfaces: ['workspace']
  }
});
