import { TbListCheck } from 'react-icons/tb';
import { LoadingState } from '../../../components/LoadingState';
import { useEntities } from '../../../hooks/useEntities';
import { useWidgetBodyTitle } from '../../../sections/dashboard/widgets/WidgetBodyTitle';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { renderSubtext } from '../dataStewardshipDashboardLogic';
import {
  isReviewsOverdueConfig,
  NotConfigured,
  StatTile,
  useDataStewardshipConfig,
  WARN,
  type ReviewsOverdueConfig
} from '../dataStewardshipWidgetSupport';

export const ReviewsOverdueWidget = ({ config }: { config: ReviewsOverdueConfig }) => {
  const title = useWidgetBodyTitle();
  const ds = useDataStewardshipConfig();
  const datasets = useEntities(
    ds.workspaceSlug,
    { schemaId: ds.schemaId ?? undefined, view: 'full', limit: 500 },
    { enabled: ds.isConfigured }
  );
  if (ds.isLoading) return <LoadingState text="Loading…" size="sm" />;
  if (!ds.isConfigured) return <NotConfigured />;
  const count = datasets.data.filter(entity => entity.review_status === 'overdue').length;
  return (
    <StatTile
      label={title ?? 'Reviews overdue'}
      value={count}
      sub={renderSubtext(config.subtextTemplate, count, 0)}
      color={count > 0 ? WARN : undefined}
    />
  );
};

export const reviewsOverdueSpec = defineComponent({
  type: 'data-stewardship-reviews-overdue',
  category: 'metrics',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbListCheck,
    label: 'Reviews overdue',
    description: 'Datasets whose scheduled review date has passed.',
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    component: ReviewsOverdueWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isReviewsOverdueConfig,
    createDefaultConfig: () => ({ subtextTemplate: 'scheduled review date passed' })
  }
});
