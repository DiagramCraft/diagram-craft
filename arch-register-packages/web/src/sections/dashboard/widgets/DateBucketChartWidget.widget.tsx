import { TbChartBar } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  DateBucketChartConfigForm,
  DateBucketChartHeaderActions,
  DateBucketChartWidget,
  dateBucketChartWidgetConfigSchema
} from './DateBucketChartWidget';

export default defineWidget({
  type: 'DateBucketChart',
  category: 'visualizations',
  name: 'Date bar chart',
  description:
    'Bars per month for a date field - record counts or a summed amount, e.g. renewals, expiries or reviews due.',
  icon: TbChartBar,
  component: DateBucketChartWidget,
  configForm: DateBucketChartConfigForm,
  configSchema: dateBucketChartWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 12,
    surfaces: ['workspace'],
    headerActionsComponent: DateBucketChartHeaderActions
  }
});
