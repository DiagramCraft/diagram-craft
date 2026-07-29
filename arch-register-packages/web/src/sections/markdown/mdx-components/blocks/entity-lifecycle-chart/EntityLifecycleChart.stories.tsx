import type { Meta, StoryObj } from '@storybook/react-vite';
import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  createStoryQueryClient
} from '../StorybookHarness';
import { workspaceAnalyticsKeys } from '../../../../../queries/workspaceAnalytics';

const analytics = {
  lifecycleBreakdown: [
    { lifecycleId: 'active', label: 'Active', color: '#22c55e', count: 64, percent: 50 },
    { lifecycleId: 'planned', label: 'Planned', color: '#f59e0b', count: 32, percent: 25 },
    { lifecycleId: null, label: 'Unassigned', color: null, count: 32, percent: 25 }
  ]
} as unknown as WorkspaceAnalytics;

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(workspaceAnalyticsKeys.detail(WORKSPACE, 90), analytics);

const meta = {
  title: 'Dashboard Widgets/EntityLifecycleChart',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[dashboardWidget('lifecycle-chart', 'entity-lifecycle-chart', {}, 0, 0, 3, 2)]}
      />
    </StoryProviders>
  )
};

export const DashboardWide: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget('lifecycle-chart-wide', 'entity-lifecycle-chart', {}, 0, 0, 6, 4)
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardLarge: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget('lifecycle-chart-large', 'entity-lifecycle-chart', {}, 0, 0, 12, 6)
        ]}
      />
    </StoryProviders>
  )
};
