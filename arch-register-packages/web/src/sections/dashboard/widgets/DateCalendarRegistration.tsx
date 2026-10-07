import { TbCalendarMonth } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DateCalendarConfigForm } from './DateCalendarConfigForm';
import {
  DateCalendarWidget,
  isDateCalendarConfigComplete,
  type DateCalendarWidgetConfig
} from './DateCalendarWidget';

export const DATE_CALENDAR_TYPE = 'DateCalendar' as const;

const optionalNumber = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

export const dateCalendarSpec: DashboardWidgetSpec<DateCalendarWidgetConfig> = {
  icon: TbCalendarMonth,
  label: 'Calendar',
  description:
    'Records placed on a month or week calendar by a date field, e.g. renewals or reviews.',
  defaultW: 12,
  defaultH: 30,
  surfaces: ['workspace'],
  component: DateCalendarWidget,
  isValidConfig: (config): config is DateCalendarWidgetConfig =>
    optionalString(config.query) &&
    optionalString(config.schemaName) &&
    (config.entityQuery === undefined || typeof config.entityQuery === 'object') &&
    typeof config.dateFieldId === 'string' &&
    (config.period === undefined || config.period === 'month' || config.period === 'week') &&
    optionalNumber(config.periodCount) &&
    optionalNumber(config.critWithinDays) &&
    optionalNumber(config.warnWithinDays) &&
    optionalString(config.sublabelFieldId) &&
    optionalString(config.valueFieldId) &&
    optionalString(config.label) &&
    isDateCalendarConfigComplete(config as DateCalendarWidgetConfig),
  createDefaultConfig: () => ({ query: '', dateFieldId: '' }),
  getTitle: config => config.label?.trim() || 'Calendar',
  configForm: DateCalendarConfigForm
};
