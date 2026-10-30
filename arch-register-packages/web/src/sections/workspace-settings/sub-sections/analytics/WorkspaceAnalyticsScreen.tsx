import { useNavigate, useSearch } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import type { SettingsSearchParams } from '../../../../routes/searchParams';
import { AnalyticsOverview } from './AnalyticsOverview';
import { StaleEntityReport } from './StaleEntityReport';

type AnalyticsView = 'overview' | 'stale';

export const WorkspaceAnalyticsScreen = ({ analyticsView }: { analyticsView?: 'stale' }) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const search = useSearch({ strict: false }) as SettingsSearchParams;

  const selectView = (view: AnalyticsView) =>
    navigate({
      to: '/$workspaceSlug/settings/$section',
      params: { workspaceSlug, section: 'analytics' },
      search: {
        ...search,
        analyticsView: view === 'stale' ? 'stale' : undefined
      }
    });

  return (
    <Tabs.Root
      autoHeight
      value={analyticsView ?? 'overview'}
      onValueChange={value => selectView(value as AnalyticsView)}
    >
      <Tabs.List aria-label="Analytics views">
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="stale">Stale entities</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview">
        <AnalyticsOverview onSelectStale={() => selectView('stale')} />
      </Tabs.Content>
      <Tabs.Content value="stale">
        <StaleEntityReport workspaceSlug={workspaceSlug} />
      </Tabs.Content>
    </Tabs.Root>
  );
};
