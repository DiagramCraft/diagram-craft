import { TbTimeline } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  DATE_RANGE_TIMELINE_TYPE,
  DateRangeTimelineConfigForm,
  DateRangeTimelineWidget,
  DateRangeTimelineWidgetConfig,
  isDateRangeTimelineConfigComplete
} from './DateRangeTimelineWidget';
import { isOptionalNumber, isOptionalString } from '../../markdown/mdx-components/configGuards';

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
      isOptionalString(config.query) &&
      isOptionalString(config.schemaName) &&
      (config.entityQuery === undefined || typeof config.entityQuery === 'object') &&
      typeof config.startFieldId === 'string' &&
      typeof config.endFieldId === 'string' &&
      isOptionalNumber(config.critWithinDays) &&
      isOptionalNumber(config.warnWithinDays) &&
      isOptionalString(config.sublabelFieldId) &&
      isOptionalString(config.valueFieldId) &&
      isOptionalString(config.markerOffsetFieldId) &&
      isOptionalString(config.markerWhenFieldId) &&
      isDateRangeTimelineConfigComplete(config as DateRangeTimelineWidgetConfig)
  }
});
