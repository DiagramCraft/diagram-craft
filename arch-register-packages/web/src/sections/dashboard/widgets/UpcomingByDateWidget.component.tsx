import { TbCalendarTime } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  UpcomingByDateConfigForm,
  UpcomingByDateWidget,
  upcomingByDateWidgetConfigSchema
} from './UpcomingByDateWidget';

export default defineComponent({
  type: 'UpcomingByDate',
  category: 'data-views',
  name: 'Upcoming by date',
  description:
    'Records ordered by an upcoming date with a countdown, e.g. renewals, expiries or reviews due.',
  icon: TbCalendarTime,
  component: UpcomingByDateWidget,
  configForm: UpcomingByDateConfigForm,
  configSchema: upcomingByDateWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace']
  }
});
