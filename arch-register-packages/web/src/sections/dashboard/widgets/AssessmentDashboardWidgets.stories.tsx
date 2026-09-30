import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { assessmentKeys, assessmentResponseKeys } from '../../../queries/assessments';
import { entitiesQuery } from '../../../queries/entities';
import { projectKeys } from '../../../queries/projectKeys';
import { workspaceConfigKeys } from '../../../queries/workspaceConfig';

const SCHEMA_ID = 'story-data-entity-schema';
const SCHEMAS = [
  { id: SCHEMA_ID, name: 'Data Entity', icon: 'database', entity_count: 3, fields: [] }
] as unknown as EntitySchema[];

const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

const assessment = (
  id: string,
  name: string,
  typeId: string,
  dueInDays: number,
  completed: number
) => ({
  id,
  workspace: WORKSPACE,
  project_id: 'project-privacy',
  name,
  description: `${name} for datasets.`,
  status: 'open',
  mode: 'confirm',
  assessment_type_id: typeId,
  scope: [SCHEMA_ID],
  scope_conditions: [],
  fields: [{ id: 'q1' }, { id: 'q2' }],
  groups: [],
  assigned_team_ids: [],
  due_at: daysFromNow(dueInDays),
  recurrence: { type: 'none' },
  response_window_days: null,
  current_occurrence: 1,
  completed_entity_count: completed
});

// Two datasets are in scope for every assessment (see `seededClient`).
const ASSESSMENTS = [
  assessment('a-overdue', 'Customer data impact assessment', 'impact', -5, 1),
  assessment('a-progress', 'Cross-border transfer assessment', 'transfer', 14, 1),
  assessment('a-new', 'Records retention survey', 'survey', 30, 0),
  assessment('a-done', 'Data quality run Q1', 'quality', -20, 2)
] as unknown as Assessment[];

const DATASETS = ['Customer master', 'Order events'].map((name, index) => ({
  _uid: `ds-${index}`,
  _publicId: `DS-${index}`,
  _name: name,
  _schema: { id: SCHEMA_ID, name: 'Data Entity' }
})) as unknown as EntityRecord[];

const seededClient = (assessments: Assessment[] = ASSESSMENTS): QueryClient => {
  const client = createStoryQueryClient();
  client.setQueryData(assessmentKeys.list(WORKSPACE), assessments);
  client.setQueryData(workspaceConfigKeys.assessmentTypes(WORKSPACE), [
    { id: 'impact', name: 'Impact assessment' },
    { id: 'transfer', name: 'Transfer assessment' },
    { id: 'survey', name: 'Records survey' },
    { id: 'quality', name: 'Data quality run' }
  ]);
  client.setQueryData(projectKeys.list(WORKSPACE), [
    { id: 'project-privacy', public_id: 'privacy', name: 'Privacy programme' }
  ]);
  for (const item of assessments) {
    client.setQueryData(assessmentResponseKeys.list(WORKSPACE, item.id), []);
    client.setQueryData(
      entitiesQuery(WORKSPACE, {
        schemaId: SCHEMA_ID,
        conditions: item.scope_conditions,
        view: 'full',
        limit: 500
      }).queryKey,
      { items: DATASETS, total: DATASETS.length }
    );
  }
  return client;
};

const widgetStory = (
  type: string,
  config: Record<string, unknown>,
  size: { w: number; h: number },
  client: QueryClient = seededClient()
) => (
  <StoryProviders client={client} schemas={SCHEMAS}>
    <DashboardStory widgets={[dashboardWidget(type, type, config, 0, 0, size.w, size.h)]} />
  </StoryProviders>
);

/**
 * Generic assessment widgets (#3505): both take the entity type whose assessments they summarise
 * as `schemaName` config; statuses are derived from each assessment's completed-entity rollup.
 */
const meta = {
  title: 'Dashboard Widgets/Assessment status and progress',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const STAT = { schemaName: 'Data Entity' };

export const StatOverdue: Story = {
  render: () =>
    widgetStory(
      'AssessmentStatusStat',
      { ...STAT, status: 'overdue', label: 'Overdue', subtextTemplate: 'past the scheduled date' },
      { w: 3, h: 5 }
    )
};

export const StatInProgress: Story = {
  render: () =>
    widgetStory(
      'AssessmentStatusStat',
      {
        ...STAT,
        status: 'in_progress',
        label: 'In progress',
        subtextTemplate: '{notStarted} not started'
      },
      { w: 3, h: 5 }
    )
};

export const StatComplete: Story = {
  render: () =>
    widgetStory(
      'AssessmentStatusStat',
      {
        ...STAT,
        status: 'complete',
        label: 'Complete',
        subtextTemplate: 'of {total} assessments'
      },
      { w: 3, h: 5 }
    )
};

export const StatUnknownSchema: Story = {
  render: () =>
    widgetStory('AssessmentStatusStat', { schemaName: 'Nope', status: 'overdue' }, { w: 3, h: 5 })
};

export const ProgressTable: Story = {
  render: () => widgetStory('AssessmentProgressTable', STAT, { w: 12, h: 14 })
};

export const ProgressTableOverdueOnly: Story = {
  render: () =>
    widgetStory('AssessmentProgressTable', { ...STAT, status: 'overdue' }, { w: 12, h: 8 })
};

export const ProgressTableEmpty: Story = {
  render: () => widgetStory('AssessmentProgressTable', STAT, { w: 12, h: 8 }, seededClient([]))
};
