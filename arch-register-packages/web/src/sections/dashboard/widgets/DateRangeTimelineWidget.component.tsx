import { TbTimeline } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  DATE_RANGE_TIMELINE_TYPE,
  DateRangeTimelineConfigForm,
  DateRangeTimelineWidget,
  dateRangeTimelineWidgetConfigSchema
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
  configSchema: dateRangeTimelineWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 30,
    surfaces: ['workspace']
  }
});
