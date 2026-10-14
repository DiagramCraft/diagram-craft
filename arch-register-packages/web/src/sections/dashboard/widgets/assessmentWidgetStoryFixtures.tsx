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

// Two datasets are in scope for every assessment.
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

export const seededAssessmentWidgetClient = (
  assessments: Assessment[] = ASSESSMENTS
): QueryClient => {
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

export const assessmentWidgetStory = (
  type: string,
  config: Record<string, unknown>,
  size: { w: number; h: number },
  client: QueryClient = seededAssessmentWidgetClient()
) => (
  <StoryProviders client={client} schemas={SCHEMAS}>
    <DashboardStory widgets={[dashboardWidget(type, type, config, 0, 0, size.w, size.h)]} />
  </StoryProviders>
);
