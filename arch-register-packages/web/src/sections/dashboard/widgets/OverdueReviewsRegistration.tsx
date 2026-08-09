import type { TElement } from 'platejs';
import { TbAlertTriangle } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { OverdueReviewsWidget, type OverdueReviewsWidgetConfig } from './OverdueReviewsWidget';
import { OverdueReviewsConfigForm } from './OverdueReviewsConfigForm';

export const OVERDUE_REVIEWS_TYPE = 'OverdueReviews' as const;

interface OverdueReviewsSlateElement extends TElement {}

/**
 * Dashboard-only widget: open assessments past their due date, optionally scoped to one entity
 * schema. Built entirely on the generic Assessment mechanism - no risk-specific fields.
 */
export const overdueReviewsSpec = defineMdxComponent<
  OverdueReviewsSlateElement,
  { config: OverdueReviewsWidgetConfig },
  'block'
>({
  component: OverdueReviewsWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbAlertTriangle,
    label: 'Overdue reviews',
    description: 'Open assessments past their due date.',
    defaultW: 3,
    defaultH: 3,
    surfaces: ['workspace', 'project'],
    component: OverdueReviewsWidget,
    isValidConfig: (config): config is OverdueReviewsWidgetConfig =>
      (config.schema === undefined || typeof config.schema === 'string') &&
      (config.label === undefined || typeof config.label === 'string'),
    createDefaultConfig: () => ({}),
    getTitle: (config: OverdueReviewsWidgetConfig) => config.label?.trim() || 'Overdue reviews',
    configForm: OverdueReviewsConfigForm
  }
});
