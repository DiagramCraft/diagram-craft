import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
  frameControls
} from '../../shared/mdx/StorybookHarness';
import { assessmentKeys } from '../../../queries/assessments';

const assessments = [
  {
    id: 'assessment-overdue',
    workspace: WORKSPACE,
    project_id: 'project-risk-register',
    name: 'Quarterly risk review',
    description: 'Review current risk exposure.',
    status: 'open',
    mode: 'confirm',
    assessment_type_id: 'risk-compliance',
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
    id: 'assessment-upcoming',
    workspace: WORKSPACE,
    project_id: 'project-checkout',
    name: 'Checkout quality review',
    description: 'Review checkout quality.',
    status: 'open',
    mode: 'fields',
    assessment_type_id: 'quality-review',
    scope: ['service'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: '2999-01-01T00:00:00.000Z',
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1
  },
  {
    id: 'assessment-undated',
    workspace: WORKSPACE,
    project_id: 'project-checkout',
    name: 'Project readiness review',
    description: 'Review project readiness.',
    status: 'open',
    mode: 'confirm',
    assessment_type_id: 'project',
    scope: ['service'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: null,
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1
  }
] as unknown as Assessment[];

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(assessmentKeys.list(WORKSPACE), assessments);

const meta = {
  title: 'Widgets/Data views/Assessments',
  tags: ['dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace and project dashboards only: A list of assessments filtered by mode (active, upcoming, overdue or all), assessment type and the entity types they cover. With `relativeDue` it shows a compact due label such as "18d" or "6d late" and the owning project. Use it on a personal or project dashboard as a work list.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDashboard = (config: Record<string, unknown>) => (
  <StoryProviders client={storyQueryClient}>
    <DashboardStory widgets={[dashboardWidget('assessments', 'Assessments', config, 0, 0, 4, 8)]} />
  </StoryProviders>
);

export const Active: Story = {
  render: () => renderDashboard({ mode: 'active' })
};

export const Upcoming: Story = {
  render: () => renderDashboard({ mode: 'upcoming' })
};

export const Overdue: Story = {
  render: () => renderDashboard({ mode: 'overdue' })
};

export const All: Story = {
  render: () => renderDashboard({ mode: 'all', label: 'All reviews' })
};

export const FilteredByAssessmentType: Story = {
  render: () => renderDashboard({ mode: 'all', assessmentTypeId: 'quality-review' })
};

export const WithFrame: Story = {
  ...Active,
  args: { showFrame: true }
};
