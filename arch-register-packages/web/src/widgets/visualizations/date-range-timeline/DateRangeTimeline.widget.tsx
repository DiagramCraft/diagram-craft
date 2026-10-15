import { TbTimeline } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import {
  DateRangeTimelineConfigForm,
  DateRangeTimelineWidget,
  dateRangeTimelineWidgetConfigSchema
} from './DateRangeTimeline';

export default defineWidget({
  type: 'DateRangeTimeline',
  category: 'visualizations',
  name: 'Date range timeline',
  description:
    'Records as a Gantt chart from a start to an end date, e.g. contract terms or project phases.',
  icon: TbTimeline,
  component: DateRangeTimelineWidget,
  configForm: DateRangeTimelineConfigForm,
  configSchema: dateRangeTimelineWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 30,
    surfaces: ['workspace']
  }
});
