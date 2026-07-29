import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { milestoneKeys } from '../../../queries/milestones';

const PROJECT_ID = 'project-checkout';

const milestones = [
  {
    id: 'milestone-discovery',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Architecture discovery',
    target_date: '2026-06-15T00:00:00.000Z',
    status: 'complete',
    sort_order: 1,
    created_at: '2026-01-10T09:00:00.000Z',
    updated_at: '2026-06-15T12:00:00.000Z'
  },
  {
    id: 'milestone-api-contract',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'API contract review',
    target_date: '2026-08-15T00:00:00.000Z',
    status: 'active',
    sort_order: 2,
    created_at: '2026-02-01T09:00:00.000Z',
    updated_at: '2026-07-20T12:00:00.000Z'
  },
  {
    id: 'milestone-migration',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Checkout migration',
    target_date: '2026-09-30T00:00:00.000Z',
    status: 'planned',
    sort_order: 3,
    created_at: '2026-02-15T09:00:00.000Z',
    updated_at: '2026-07-18T12:00:00.000Z'
  },
  {
    id: 'milestone-launch',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Production launch',
    target_date: '2026-11-15T00:00:00.000Z',
    status: 'planned',
    sort_order: 4,
    created_at: '2026-03-01T09:00:00.000Z',
    updated_at: '2026-07-17T12:00:00.000Z'
  },
  {
    id: 'milestone-cancelled',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Cancelled experiment',
    target_date: '2026-07-01T00:00:00.000Z',
    status: 'cancelled',
    sort_order: 5,
    created_at: '2026-03-15T09:00:00.000Z',
    updated_at: '2026-07-01T12:00:00.000Z'
  }
] as unknown as Milestone[];

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(milestoneKeys.list(WORKSPACE, PROJECT_ID), milestones);

const meta = {
  title: 'Dashboard Widgets/UpcomingMilestones',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDashboard = (w: number, h: number, id: string) => (
  <StoryProviders client={storyQueryClient} projectId={PROJECT_ID}>
    <DashboardStory widgets={[dashboardWidget(id, 'upcoming-milestones', {}, 0, 0, w, h)]} />
  </StoryProviders>
);

export const DashboardDefault: Story = {
  render: () => renderDashboard(3, 2, 'upcoming-milestones')
};

export const DashboardWide: Story = {
  render: () => renderDashboard(6, 4, 'upcoming-milestones-wide')
};

export const DashboardLarge: Story = {
  render: () => renderDashboard(12, 6, 'upcoming-milestones-large')
};
