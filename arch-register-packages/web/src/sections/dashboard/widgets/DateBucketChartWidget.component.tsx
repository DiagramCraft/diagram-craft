import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { DATE_BUCKET_CHART_TYPE, _dateBucketChartSpecData } from './DateBucketChartWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _dateBucketChartSpecData;
export default defineComponent({
  type: DATE_BUCKET_CHART_TYPE,
  category: 'visualizations',
  name: 'Date bar chart',
  description:
    'Bars per month for a date field - record counts or a summed amount, e.g. renewals, expiries or reviews due.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
