import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../sections/markdown/mdx-components/blocks/StorybookHarness';
import { governanceCasesQuery } from '../../queries/governance';
import { entityDetailQuery, entitiesQuery } from '../../queries/entities';

const SCHEMA_ID = 'story-data-entity-schema';
const casesQuery = { status: 'open', subjectType: 'entity' } as const;

const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

const CASES = [
  {
    id: 'case-overdue-1',
    caseKind: 'entity.change-case',
    subjectId: 'ds-1',
    payload: { kind: 'change-proposal', revisionId: 'rev-1' },
    dueAt: daysFromNow(-3)
  },
  {
    id: 'case-soon-2',
    caseKind: 'entity.deprecation',
    subjectId: 'ds-2',
    payload: { kind: 'deprecation' },
    dueAt: daysFromNow(4)
  },
  {
    id: 'case-later-3',
    caseKind: 'entity.change-case',
    subjectId: 'ds-3',
    payload: { kind: 'change-proposal', revisionId: 'rev-3' },
    dueAt: daysFromNow(20)
  }
].map(entry => ({
  ...entry,
  subjectType: 'entity',
  status: 'open'
})) as unknown as GovernanceCase[];

const DATASETS = [
  { id: 'ds-1', name: 'Customer master', review: 'overdue' },
  { id: 'ds-2', name: 'Order events', review: 'ok' },
  { id: 'ds-3', name: 'Payment ledger', review: 'overdue' }
].map(({ id, name, review }) => ({
  _uid: id,
  _publicId: id.toUpperCase(),
  _name: name,
  _schema: { id: SCHEMA_ID, name: 'Data Entity' },
  review_status: review
})) as unknown as EntityRecord[];

const seededClient = ({ cases = CASES }: { cases?: GovernanceCase[] } = {}): QueryClient => {
  const client = createStoryQueryClient();
  client.setQueryData(governanceCasesQuery(WORKSPACE, casesQuery).queryKey, cases);
  for (const dataset of DATASETS) {
    client.setQueryData(entityDetailQuery(WORKSPACE, dataset._uid).queryKey, dataset);
  }
  client.setQueryData(
    entitiesQuery(WORKSPACE, { schemaId: SCHEMA_ID, view: 'full', limit: 500 }).queryKey,
    { items: DATASETS, total: DATASETS.length }
  );
  return client;
};

const widgetStory = (
  type: string,
  config: Record<string, unknown>,
  size: { w: number; h: number },
  client: QueryClient,
  configured = true
) => (
  <StoryProviders
    client={client}
    schemas={
      configured
        ? ([{ id: SCHEMA_ID, name: 'Data Entity', fields: [] }] as unknown as Parameters<
            typeof StoryProviders
          >[0]['schemas'])
        : []
    }
  >
    <DashboardStory widgets={[dashboardWidget(type, type, config, 0, 0, size.w, size.h)]} />
  </StoryProviders>
);

/**
 * The Data Stewardship "My work" dashboard widgets (#3501): governance-case stat tiles, the
 * six-week case calendar, and the due-date-sorted case queue, all driven by widget config
 * (`scope` / `caseKinds`) plus the app's capability config for the schema to join against.
 */
const meta = {
  title: 'Dashboard Widgets/DataStewardship',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const COUNT_CONFIG = {
  label: 'Cases awaiting a decision',
  scope: 'workspace',
  caseKinds: ['entity.change-case', 'entity.deprecation'],
  tone: 'warning',
  subtextTemplate: '{due} due within a week',
  dueWithinDays: 7
};

export const CaseCount: Story = {
  render: () =>
    widgetStory('data-stewardship-case-count', COUNT_CONFIG, { w: 3, h: 5 }, seededClient())
};

export const CaseCountPastDue: Story = {
  render: () =>
    widgetStory(
      'data-stewardship-case-count',
      { ...COUNT_CONFIG, label: 'Past due', scope: 'late', tone: 'danger', caseKinds: [] },
      { w: 3, h: 5 },
      seededClient()
    )
};

export const CaseCountNotConfigured: Story = {
  render: () =>
    widgetStory('data-stewardship-case-count', COUNT_CONFIG, { w: 3, h: 5 }, seededClient(), false)
};

export const ReviewsOverdue: Story = {
  render: () =>
    widgetStory(
      'data-stewardship-reviews-overdue',
      { subtextTemplate: 'scheduled review date passed' },
      { w: 3, h: 5 },
      seededClient()
    )
};

export const CaseCalendar: Story = {
  render: () =>
    widgetStory(
      'data-stewardship-case-calendar',
      { label: 'Next six weeks', scope: 'workspace', caseKinds: [] },
      { w: 12, h: 14 },
      seededClient()
    )
};

export const CaseCalendarEmpty: Story = {
  render: () =>
    widgetStory(
      'data-stewardship-case-calendar',
      { label: 'Next six weeks', scope: 'workspace', caseKinds: [] },
      { w: 12, h: 14 },
      seededClient({ cases: [] })
    )
};

export const CaseQueue: Story = {
  render: () =>
    widgetStory(
      'data-stewardship-case-queue',
      { label: 'All open items', scope: 'workspace', caseKinds: [] },
      { w: 12, h: 22 },
      seededClient()
    )
};

export const CaseQueueEmpty: Story = {
  render: () =>
    widgetStory(
      'data-stewardship-case-queue',
      { label: 'All open items', scope: 'workspace', caseKinds: [] },
      { w: 12, h: 12 },
      seededClient({ cases: [] })
    )
};

/** The seeded My work layout: four tiles, the calendar, then the queue. */
export const FullDashboard: Story = {
  render: () => (
    <StoryProviders client={seededClient()}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'a',
            'data-stewardship-case-count',
            {
              ...COUNT_CONFIG,
              label: 'Assigned to me',
              scope: 'workspace',
              tone: 'none',
              caseKinds: []
            },
            0,
            0,
            3,
            5
          ),
          dashboardWidget(
            'b',
            'data-stewardship-case-count',
            { ...COUNT_CONFIG, label: 'Past due', scope: 'late', tone: 'danger', caseKinds: [] },
            3,
            0,
            3,
            5
          ),
          dashboardWidget('c', 'data-stewardship-case-count', COUNT_CONFIG, 6, 0, 3, 5),
          dashboardWidget(
            'd',
            'data-stewardship-reviews-overdue',
            { subtextTemplate: 'scheduled review date passed' },
            9,
            0,
            3,
            5
          ),
          dashboardWidget(
            'e',
            'data-stewardship-case-calendar',
            { label: 'Next six weeks', scope: 'workspace', caseKinds: [] },
            0,
            5,
            12,
            14
          ),
          dashboardWidget(
            'f',
            'data-stewardship-case-queue',
            { label: 'All open items', scope: 'workspace', caseKinds: [] },
            0,
            19,
            12,
            22
          )
        ]}
      />
    </StoryProviders>
  )
};
