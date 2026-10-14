/**
 * Dashboard-only widget: a percentage/coverage stat computed as (entities matching a configured
 * condition) / (entities matching the base schema/owner/lifecycle filter), scoped to whatever
 * entity schema the widget is configured against - not tied to any particular schema.
 */
import { TbPercentage } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  AggregateStatConfigForm,
  AggregateStatWidget,
  aggregateStatWidgetConfigSchema
} from './AggregateStatWidget';
export default defineComponent({
  type: 'AggregateStat',
  category: 'metrics',
  name: 'Aggregate stat',
  description:
    'A count or percentage of records matching a query, e.g. coverage, compliance or items needing attention.',
  icon: TbPercentage,
  component: AggregateStatWidget,
  configForm: AggregateStatConfigForm,
  configSchema: aggregateStatWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
