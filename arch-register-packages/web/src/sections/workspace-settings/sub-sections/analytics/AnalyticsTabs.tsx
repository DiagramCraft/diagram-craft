import { Tabs } from '@diagram-craft/app-components/Tabs';

type AnalyticsView = 'overview' | 'stale';

export const AnalyticsTabs = ({
  active,
  onSelect
}: {
  active: AnalyticsView;
  onSelect: (view: AnalyticsView) => void;
}) => (
  <Tabs.Root value={active} onValueChange={value => onSelect(value as AnalyticsView)}>
    <Tabs.List aria-label="Analytics views">
      <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
      <Tabs.Trigger value="stale">Stale entities</Tabs.Trigger>
    </Tabs.List>
  </Tabs.Root>
);
