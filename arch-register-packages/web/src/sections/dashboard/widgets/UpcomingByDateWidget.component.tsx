import { TbCalendarTime } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  UPCOMING_BY_DATE_TYPE,
  UpcomingByDateConfigForm,
  UpcomingByDateWidget,
  UpcomingByDateWidgetConfig,
  isOptionalNumber,
  isUpcomingByDateConfigComplete,
  optionalString
} from './UpcomingByDateWidget';

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
    isValidConfig: (config): config is UpcomingByDateWidgetConfig =>
      typeof config.query === 'string' &&
      typeof config.dateFieldId === 'string' &&
      isOptionalNumber(config.windowDays) &&
      isOptionalNumber(config.limit) &&
      isOptionalNumber(config.critWithinDays) &&
      isOptionalNumber(config.warnWithinDays) &&
      optionalString(config.sublabelFieldId) &&
      optionalString(config.valueFieldId) &&
      (config.includeOverdue === undefined || typeof config.includeOverdue === 'boolean') &&
      isUpcomingByDateConfigComplete(config as UpcomingByDateWidgetConfig)
  }
});
