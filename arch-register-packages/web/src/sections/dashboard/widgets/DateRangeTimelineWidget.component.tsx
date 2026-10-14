import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { DATE_RANGE_TIMELINE_TYPE, _dateRangeTimelineSpecData } from './DateRangeTimelineWidget';
export default defineComponent({
  type: DATE_RANGE_TIMELINE_TYPE,
  category: 'visualizations',
  name: 'Date range timeline',
  description:
    'Records as a Gantt chart from a start to an end date, e.g. contract terms or project phases.',
  dashboardWidget: _dateRangeTimelineSpecData
});
