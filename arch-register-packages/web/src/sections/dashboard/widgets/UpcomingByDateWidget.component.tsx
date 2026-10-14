import { TbCalendarTime } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  UPCOMING_BY_DATE_TYPE,
  UpcomingByDateConfigForm,
  UpcomingByDateWidget,
  upcomingByDateWidgetConfigSchema
} from './UpcomingByDateWidget';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';

export default defineComponent({
  type: UPCOMING_BY_DATE_TYPE,
  category: 'data-views',
  name: 'Upcoming by date',
  description:
    'Records ordered by an upcoming date with a countdown, e.g. renewals, expiries or reviews due.',
  icon: TbCalendarTime,
  component: UpcomingByDateWidget,
  createDefaultProps: () => ({ config: { query: '', dateFieldId: '' } }),
  configForm: UpcomingByDateConfigForm,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    isValidConfig: schemaGuard(upcomingByDateWidgetConfigSchema)
  }
});
