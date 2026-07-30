import type { Meta, StoryObj } from '@storybook/react-vite';
import type { WorkspaceAnalytics } from '@arch-register/api-types/analyticsContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  createStoryQueryClient
} from '../../blocks/StorybookHarness';
import { entityKeys } from '../../../../../queries/entities';
import { workspaceAnalyticsKeys } from '../../../../../queries/workspaceAnalytics';

const staleAfterDays = 90;
const cutoffAt = '2026-04-30T00:00:00.000Z';
const staleQueryOptions = {
  conditions: [{ fieldId: '_updatedAt', op: 'before' as const, value: cutoffAt }],
  view: 'summary' as const,
  limit: 25,
  offset: 0
};

const analytics = {
  lifecycleBreakdown: [
    { lifecycleId: 'active', label: 'Active', color: '#22c55e', count: 64, percent: 50 },
    { lifecycleId: 'planned', label: 'Planned', color: '#f59e0b', count: 32, percent: 25 },
    { lifecycleId: null, label: 'Unassigned', color: null, count: 32, percent: 25 }
  ],
  stale: {
    thresholdDays: staleAfterDays,
    cutoffAt,
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

const staleEntities = [
  {
    _uid: 'entity-payments',
    _publicId: 'payments-api',
    _name: 'Payments API',
    _updatedAt: '2026-03-12T09:30:00.000Z',
    _schema: { id: 'service', name: 'Service' }
  },
  {
    _uid: 'entity-orders',
    _publicId: 'orders-service',
    _name: 'Orders Service',
    _updatedAt: '2026-02-21T14:15:00.000Z',
    _schema: { id: 'service', name: 'Service' }
  }
];

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(workspaceAnalyticsKeys.detail(WORKSPACE, staleAfterDays), analytics);
storyQueryClient.setQueryData(entityKeys.list(WORKSPACE, staleQueryOptions), {
  items: staleEntities,
  total: staleEntities.length
});

const meta = {
  title: 'Dashboard Widgets/EntityStaleReport',
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
          dashboardWidget('stale-report', 'entity-stale-report', { staleAfterDays }, 0, 0, 3, 2)
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
            'stale-report-wide',
            'entity-stale-report',
            { staleAfterDays },
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
            'stale-report-large',
            'entity-stale-report',
            { staleAfterDays },
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
