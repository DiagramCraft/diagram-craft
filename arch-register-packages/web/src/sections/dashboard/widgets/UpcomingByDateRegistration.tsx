import { TbCalendarTime } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { UpcomingByDateConfigForm } from './UpcomingByDateConfigForm';
import {
  UpcomingByDateWidget,
  isUpcomingByDateConfigComplete,
  type UpcomingByDateWidgetConfig
} from './UpcomingByDateWidget';

export const UPCOMING_BY_DATE_TYPE = 'UpcomingByDate' as const;

const optionalNumber = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

export const upcomingByDateSpec: DashboardWidgetSpec<UpcomingByDateWidgetConfig> = {
  icon: TbCalendarTime,
  label: 'Upcoming by date',
  description:
    'Records ordered by an upcoming date with a countdown, e.g. renewals, expiries or reviews due.',
  defaultW: 6,
  defaultH: 16,
  surfaces: ['workspace'],
  component: UpcomingByDateWidget,
  isValidConfig: (config): config is UpcomingByDateWidgetConfig =>
    typeof config.query === 'string' &&
    typeof config.dateFieldId === 'string' &&
    optionalNumber(config.windowDays) &&
    optionalNumber(config.limit) &&
    optionalNumber(config.critWithinDays) &&
    optionalNumber(config.warnWithinDays) &&
    optionalString(config.sublabelFieldId) &&
    optionalString(config.valueFieldId) &&
    optionalString(config.label) &&
    (config.includeOverdue === undefined || typeof config.includeOverdue === 'boolean') &&
    isUpcomingByDateConfigComplete(config as UpcomingByDateWidgetConfig),
  createDefaultConfig: () => ({ query: '', dateFieldId: '' }),
  getTitle: config => config.label?.trim() || 'Upcoming by date',
  configForm: UpcomingByDateConfigForm
};
