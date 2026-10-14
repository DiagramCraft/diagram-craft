import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { DATE_CALENDAR_TYPE, _dateCalendarSpecData } from './DateCalendarWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _dateCalendarSpecData;
export default defineComponent({
  type: DATE_CALENDAR_TYPE,
  category: 'visualizations',
  name: 'Calendar',
  description:
    'Records placed on a month or week calendar by a date field, e.g. renewals or reviews.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
