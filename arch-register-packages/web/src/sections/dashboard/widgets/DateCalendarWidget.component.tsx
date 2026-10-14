import { TbCalendarMonth } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  DATE_CALENDAR_TYPE,
  DateCalendarConfigForm,
  DateCalendarWidget,
  DateCalendarWidgetConfig,
  isDateCalendarConfigComplete
} from './DateCalendarWidget';
import { isOptionalNumber, isOptionalString } from '../../markdown/mdx-components/configGuards';

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
  dashboardWidget: {
    defaultW: 12,
    defaultH: 30,
    surfaces: ['workspace'],
    isValidConfig: (config): config is DateCalendarWidgetConfig =>
      isOptionalString(config.query) &&
      isOptionalString(config.schemaName) &&
      (config.entityQuery === undefined || typeof config.entityQuery === 'object') &&
      typeof config.dateFieldId === 'string' &&
      (config.period === undefined || config.period === 'month' || config.period === 'week') &&
      isOptionalNumber(config.periodCount) &&
      isOptionalNumber(config.critWithinDays) &&
      isOptionalNumber(config.warnWithinDays) &&
      isOptionalString(config.sublabelFieldId) &&
      isOptionalString(config.valueFieldId) &&
      isDateCalendarConfigComplete(config as DateCalendarWidgetConfig)
  }
});
