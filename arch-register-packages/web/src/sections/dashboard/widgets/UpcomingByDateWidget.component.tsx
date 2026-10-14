import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { UPCOMING_BY_DATE_TYPE, _upcomingByDateSpecData } from './UpcomingByDateWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _upcomingByDateSpecData;
export default defineComponent({
  type: UPCOMING_BY_DATE_TYPE,
  category: 'data-views',
  name: 'Upcoming by date',
  description:
    'Records ordered by an upcoming date with a countdown, e.g. renewals, expiries or reviews due.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
