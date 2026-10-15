import { TbCalendarTime } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  UpcomingByDateConfigForm,
  UpcomingByDateWidget,
  upcomingByDateWidgetConfigSchema
} from './UpcomingByDateWidget';

export default defineWidget({
  type: 'UpcomingByDate',
  category: 'data-views',
  name: 'Upcoming by date',
  description:
    'Records ordered by an upcoming date with a countdown, e.g. renewals, expiries or reviews due.',
  icon: TbCalendarTime,
  component: UpcomingByDateWidget,
  configForm: UpcomingByDateConfigForm,
  configSchema: upcomingByDateWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace']
  }
});
