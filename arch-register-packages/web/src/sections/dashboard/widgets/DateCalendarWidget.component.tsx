import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { DATE_CALENDAR_TYPE, _dateCalendarSpecData } from './DateCalendarWidget';
export default defineComponent({
  type: DATE_CALENDAR_TYPE,
  category: 'visualizations',
  name: 'Calendar',
  description:
    'Records placed on a month or week calendar by a date field, e.g. renewals or reviews.',
  dashboardWidget: _dateCalendarSpecData
});
