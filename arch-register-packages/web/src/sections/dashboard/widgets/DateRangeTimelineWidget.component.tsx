import { TbTimeline } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  DATE_RANGE_TIMELINE_TYPE,
  DateRangeTimelineConfigForm,
  DateRangeTimelineWidget,
  DateRangeTimelineWidgetConfig,
  isDateRangeTimelineConfigComplete,
  optionalNumber,
  optionalString
} from './DateRangeTimelineWidget';

export default defineComponent({
  type: DATE_RANGE_TIMELINE_TYPE,
  category: 'visualizations',
  name: 'Date range timeline',
  description:
    'Records as a Gantt chart from a start to an end date, e.g. contract terms or project phases.',
  icon: TbTimeline,
  component: DateRangeTimelineWidget,
  createDefaultProps: () => ({ config: { query: '', startFieldId: '', endFieldId: '' } }),
  configForm: DateRangeTimelineConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 30,
    surfaces: ['workspace'],
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
      isDateRangeTimelineConfigComplete(config as DateRangeTimelineWidgetConfig)
  }
});
