import { LoadingState } from '../../../components/LoadingState';
import { useEntities } from '../../../hooks/useEntities';
import { useWidgetBodyTitle } from '../../../widgets/shared/dashboard/WidgetBodyTitle';

import { renderSubtext } from '../dataStewardshipDashboardLogic';
import {
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
