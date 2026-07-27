import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useWorkspaceAnalytics } from '../../../../../hooks/useWorkspaceAnalytics';
import { EmptyState } from '../../../../../components/EmptyState';
import { LoadingState } from '../../../../../components/LoadingState';
import { LifecycleSection } from '../../../../workspace-settings/sub-sections/analytics/LifecycleSection';

const DEFAULT_STALE_AFTER_DAYS = 90;

export const EntityLifecycleChart = () => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();

  const {
    data: analytics,
    isLoading,
    isError
  } = useWorkspaceAnalytics(workspaceSlug, DEFAULT_STALE_AFTER_DAYS);

  if (isLoading) return <LoadingState text="Loading lifecycle breakdown…" size="sm" />;
  if (isError || analytics == null)
    return <EmptyState compact title="Lifecycle breakdown could not be loaded." />;

  return (
    <LifecycleSection
      analytics={analytics}
      onNavigate={search =>
        navigate({
          to: '/$workspaceSlug/entities',
          params: { workspaceSlug },
          search
        })
      }
      bare
    />
  );
};
