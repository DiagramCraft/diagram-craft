import type { Meta, StoryObj } from '@storybook/react-vite';
import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  createStoryQueryClient,
  frameControls
} from '../../shared/mdx/StorybookHarness';
import { workspaceAnalyticsKeys } from '../../../queries/workspaceAnalytics';

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
  title: 'Widgets/Visualizations/Lifecycle chart',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: A donut chart that breaks down the entities of the workspace by lifecycle state (for example proposed, active and retired). It has no options of its own; use Entity chart on a wiki page if you need to filter.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
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

export const WithFrame: Story = {
  ...Default,
  args: { showFrame: true }
};
