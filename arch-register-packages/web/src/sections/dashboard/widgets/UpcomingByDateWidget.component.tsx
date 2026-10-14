import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { UPCOMING_BY_DATE_TYPE, _upcomingByDateSpecData } from './UpcomingByDateWidget';
export default defineComponent({
  type: UPCOMING_BY_DATE_TYPE,
  category: 'data-views',
  name: 'Upcoming by date',
  description:
    'Records ordered by an upcoming date with a countdown, e.g. renewals, expiries or reviews due.',
  dashboardWidget: _upcomingByDateSpecData
});
