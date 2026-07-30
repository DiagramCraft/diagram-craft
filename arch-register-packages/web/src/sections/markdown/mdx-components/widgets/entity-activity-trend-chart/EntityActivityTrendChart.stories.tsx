import type { Meta, StoryObj } from '@storybook/react-vite';
import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  createStoryQueryClient
} from '../../blocks/StorybookHarness';
import { workspaceAnalyticsKeys } from '../../../../../queries/workspaceAnalytics';

const staleAfterDays = 90;
const staleCutoffAt = '2026-04-30T00:00:00.000Z';

const createActivityBuckets = (days: number) =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(2026, 4, 1 + index));
    const dateString = date.toISOString().slice(0, 10);
    return {
      date: dateString,
      startDate: `${dateString}T00:00:00.000Z`,
      endDate: `${dateString}T23:59:59.999Z`,
      created: index % 7 === 0 ? 2 : 0,
      updated: index % 3 === 0 ? 4 : index % 2 === 0 ? 1 : 0
    };
  });

const analytics = {
  lifecycleBreakdown: [
    { lifecycleId: 'active', label: 'Active', color: '#22c55e', count: 64, percent: 50 },
    { lifecycleId: 'planned', label: 'Planned', color: '#f59e0b', count: 32, percent: 25 },
    { lifecycleId: null, label: 'Unassigned', color: null, count: 32, percent: 25 }
  ],
  activityTrends: {
    days30: createActivityBuckets(30),
    days90: createActivityBuckets(90)
  },
  stale: {
    thresholdDays: staleAfterDays,
    cutoffAt: staleCutoffAt,
    totalCount: 2,
    percent: 25,
    schemas: [
      {
        schemaId: 'service',
        schemaName: 'Service',
        totalCount: 8,
        staleCount: 2,
        stalePercent: 25
      }
    ]
  }
} as unknown as WorkspaceAnalytics;

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(workspaceAnalyticsKeys.detail(WORKSPACE, staleAfterDays), analytics);

const meta = {
  title: 'Dashboard Widgets/EntityActivityTrendChart',
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
        widgets={[
          dashboardWidget(
            'activity-trend',
            'entity-activity-trend-chart',
            { lookbackDays: 30 },
            0,
            0,
            3,
            2
          )
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardWide: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'activity-trend-wide',
            'entity-activity-trend-chart',
            { lookbackDays: 90 },
            0,
            0,
            6,
            4
          )
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
          dashboardWidget(
            'activity-trend-large',
            'entity-activity-trend-chart',
            { lookbackDays: 90 },
            0,
            0,
            12,
            6
          )
        ]}
      />
    </StoryProviders>
  )
};
