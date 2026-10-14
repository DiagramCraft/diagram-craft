import { TbListCheck } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isReviewsOverdueConfig } from '../dataStewardshipWidgetSupport';
import { ReviewsOverdueWidget } from './ReviewsOverdueWidget';
export default defineComponent({
  type: 'data-stewardship-reviews-overdue',
  category: 'metrics',
  name: 'Reviews overdue',
  description: 'Datasets whose scheduled review date has passed.',
  dashboardWidget: {
    icon: TbListCheck,
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    component: ReviewsOverdueWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isReviewsOverdueConfig,
    createDefaultConfig: () => ({ subtextTemplate: 'scheduled review date passed' })
  }
});
