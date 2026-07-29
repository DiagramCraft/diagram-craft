import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { Project } from '@arch-register/api-types/projectContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { assessmentKeys } from '../../../queries/assessments';
import { projectKeys } from '../../../queries/projects';

const PROJECT_ID = 'project-checkout';

const project = {
  id: PROJECT_ID,
  public_id: 'checkout-modernization',
  workspace: WORKSPACE,
  name: 'Checkout Modernization',
  description: 'Modernize the checkout platform.',
  owner: null,
  status: 'active',
  color: '#6366f1',
  target_date: '2026-12-15T00:00:00.000Z',
  pinned: false,
  file_count: 2,
  created_at: '2026-01-10T09:00:00.000Z',
  updated_at: '2026-07-20T09:00:00.000Z',
  canEdit: false,
  canDelete: false,
  canManageFiles: false
} as unknown as Project;

const assessments = [
  {
    id: 'assessment-api-health',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'API health review',
    description: 'Review reliability and ownership of core APIs.',
    status: 'open',
    mode: 'fields',
    scope: ['service'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: '2026-08-15T00:00:00.000Z',
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1
  },
  {
    id: 'assessment-platform-readiness',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Platform readiness',
    description: 'Assess readiness for the next platform milestone.',
    status: 'open',
    mode: 'confirm',
    scope: ['service'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: '2026-09-01T00:00:00.000Z',
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1
  },
  {
    id: 'assessment-closed',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Completed architecture review',
    description: 'A completed review retained for history.',
    status: 'closed',
    mode: 'confirm',
    scope: ['service'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: '2026-06-01T00:00:00.000Z',
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1
  }
] as unknown as Assessment[];

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(projectKeys.detail(WORKSPACE, PROJECT_ID), project);
storyQueryClient.setQueryData(assessmentKeys.list(WORKSPACE), assessments);

const meta = {
  title: 'Dashboard Widgets/ActiveAssessments',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDashboard = (w: number, h: number, id: string) => (
  <StoryProviders client={storyQueryClient} projectId={PROJECT_ID}>
    <DashboardStory widgets={[dashboardWidget(id, 'active-assessments', {}, 0, 0, w, h)]} />
  </StoryProviders>
);

export const DashboardDefault: Story = {
  render: () => renderDashboard(3, 2, 'active-assessments')
};

export const DashboardWide: Story = {
  render: () => renderDashboard(6, 4, 'active-assessments-wide')
};

export const DashboardLarge: Story = {
  render: () => renderDashboard(12, 6, 'active-assessments-large')
};
