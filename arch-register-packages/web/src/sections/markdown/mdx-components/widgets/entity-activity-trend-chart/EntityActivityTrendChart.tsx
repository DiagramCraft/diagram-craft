import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useWorkspaceAnalytics } from '../../../../../hooks/useWorkspaceAnalytics';
import { EmptyState } from '../../../../../components/EmptyState';
import { LoadingState } from '../../../../../components/LoadingState';
import { ActivityTrendsSection } from '../../../../workspace-settings/sub-sections/analytics/ActivityTrendsSection';
import { activityAuditSearch } from '../../../../workspace-settings/sub-sections/analytics/workspaceAnalyticsHelpers';
import type { EntityActivityTrendChartProps } from './types';

const DEFAULT_STALE_AFTER_DAYS = 90;

export const EntityActivityTrendChart = ({ lookbackDays }: EntityActivityTrendChartProps) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const initialWindowDays = lookbackDays === 90 ? 90 : 30;

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
