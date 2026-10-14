import { TbListCheck } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { reviewsOverdueConfigSchema } from '../dataStewardshipWidgetSupport';
import { ReviewsOverdueWidget } from './ReviewsOverdueWidget';
export default defineComponent({
  type: 'data-stewardship-reviews-overdue',
  category: 'metrics',
  name: 'Reviews overdue',
  description: 'Datasets whose scheduled review date has passed.',
  icon: TbListCheck,
  component: ReviewsOverdueWidget,
  createDefaultProps: () => ({ config: { subtextTemplate: 'scheduled review date passed' } }),
  configSchema: reviewsOverdueConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
