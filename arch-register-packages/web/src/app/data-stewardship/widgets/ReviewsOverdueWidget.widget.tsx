import { TbListCheck } from 'react-icons/tb';
import { defineWidget } from '../../../sections/markdown/mdx-components/defineWidget';
import { reviewsOverdueConfigSchema } from '../dataStewardshipWidgetSupport';
import { ReviewsOverdueWidget } from './ReviewsOverdueWidget';
export default defineWidget({
  type: 'data-stewardship-reviews-overdue',
  category: 'metrics',
  name: 'Reviews overdue',
  description: 'Datasets whose scheduled review date has passed.',
  icon: TbListCheck,
  component: ReviewsOverdueWidget,
  configSchema: reviewsOverdueConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
