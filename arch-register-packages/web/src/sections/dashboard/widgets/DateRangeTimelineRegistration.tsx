import { TbTimeline } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DateRangeTimelineConfigForm } from './DateRangeTimelineConfigForm';
import {
  DateRangeTimelineWidget,
  isDateRangeTimelineConfigComplete,
  type DateRangeTimelineWidgetConfig
} from './DateRangeTimelineWidget';

export const DATE_RANGE_TIMELINE_TYPE = 'DateRangeTimeline' as const;

const optionalNumber = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

export const dateRangeTimelineSpec: DashboardWidgetSpec<DateRangeTimelineWidgetConfig> = {
  icon: TbTimeline,
  label: 'Date range timeline',
  description:
    'Records as a Gantt chart from a start to an end date, e.g. contract terms or project phases.',
  defaultW: 12,
  defaultH: 30,
  surfaces: ['workspace'],
  component: DateRangeTimelineWidget,
  isValidConfig: (config): config is DateRangeTimelineWidgetConfig =>
    optionalString(config.query) &&
    optionalString(config.schemaName) &&
    (config.entityQuery === undefined || typeof config.entityQuery === 'object') &&
    typeof config.startFieldId === 'string' &&
    typeof config.endFieldId === 'string' &&
    optionalNumber(config.critWithinDays) &&
    optionalNumber(config.warnWithinDays) &&
    optionalString(config.sublabelFieldId) &&
    optionalString(config.valueFieldId) &&
    optionalString(config.markerOffsetFieldId) &&
    optionalString(config.markerWhenFieldId) &&
    optionalString(config.label) &&
    isDateRangeTimelineConfigComplete(config as DateRangeTimelineWidgetConfig),
  createDefaultConfig: () => ({ query: '', startFieldId: '', endFieldId: '' }),
  getTitle: config => config.label?.trim() || 'Date range timeline',
  configForm: DateRangeTimelineConfigForm
};
