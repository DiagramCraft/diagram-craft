import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useWorkspaceAnalytics } from '../../../hooks/useWorkspaceAnalytics';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { ActivityTrendsSection } from '../../../sections/workspace-settings/sub-sections/analytics/ActivityTrendsSection';
import { activityAuditSearch } from '../../../sections/workspace-settings/sub-sections/analytics/workspaceAnalyticsHelpers';
import type { EntityActivityTrendChartProps } from './types';

const DEFAULT_STALE_AFTER_DAYS = 90;

export const EntityActivityTrendChart = ({ config }: { config: EntityActivityTrendChartProps }) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const initialWindowDays = config.lookbackDays === 90 ? 90 : 30;

  const {
    data: analytics,
    isLoading,
    isError
  } = useWorkspaceAnalytics(workspaceSlug, DEFAULT_STALE_AFTER_DAYS);

  if (isLoading) return <LoadingState text="Loading activity trends…" size="sm" />;
  if (isError || analytics == null)
    return <EmptyState compact title="Activity trends could not be loaded." />;

  return (
    <ActivityTrendsSection
      analytics={analytics}
      initialWindowDays={initialWindowDays}
      onNavigate={(operation, startDate, endDate) =>
        navigate({
          to: '/$workspaceSlug/settings/$section',
          params: { workspaceSlug, section: 'audit' },
          search: activityAuditSearch(operation, startDate, endDate)
        })
      }
    />
  );
};
