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

const PROJECT_ID = 'project-risk-register';

const project = {
  id: PROJECT_ID,
  public_id: 'risk-register',
  workspace: WORKSPACE,
  name: 'Risk register',
  owner: null,
  status: 'active',
  color: '#ef4444',
  file_count: 1,
  canEdit: false,
  canDelete: false,
  canManageFiles: false
} as unknown as Project;

const assessments = [
  {
    id: 'assessment-risk-review',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Quarterly risk review',
    status: 'open',
    scope: ['risk'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: '2026-01-15T00:00:00.000Z',
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1
  },
  {
    id: 'assessment-control-review',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Control effectiveness review',
    status: 'open',
    scope: ['control'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: '2026-03-01T00:00:00.000Z',
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1
  },
  {
    id: 'assessment-not-due',
    workspace: WORKSPACE,
    project_id: PROJECT_ID,
    name: 'Upcoming service review',
    status: 'open',
    scope: ['service'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: '2999-01-01T00:00:00.000Z',
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1
  }
] as unknown as Assessment[];

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(projectKeys.detail(WORKSPACE, PROJECT_ID), project);
storyQueryClient.setQueryData(assessmentKeys.list(WORKSPACE), assessments);

const meta = {
  title: 'Dashboard Widgets/OverdueReviews',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkspaceDashboard: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[dashboardWidget('overdue-reviews', 'OverdueReviews', {}, 0, 0, 3, 3)]}
      />
    </StoryProviders>
  )
};

export const ScopedToRiskSchema: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'overdue-risk-reviews',
            'OverdueReviews',
            { schema: 'risk', label: 'Overdue risk reviews' },
            0,
            0,
            3,
            3
          )
        ]}
      />
    </StoryProviders>
  )
};
