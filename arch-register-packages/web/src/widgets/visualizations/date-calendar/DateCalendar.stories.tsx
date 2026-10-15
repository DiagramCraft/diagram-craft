import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { entityDetailQuery } from '../../../queries/entities';
import { governanceCasesQuery } from '../../../queries/governance';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';

const QUERY = 'schema:"Contract"';

const monthsFromNow = (months: number, day: number): string => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + months, day, 12).toISOString().slice(0, 10);
};

const contracts = [
  ['Cloud hosting', 'Acme Cloud', -1, 12, 120000],
  ['Support plan', 'Acme Cloud', 0, 28, 24000],
  ['Analytics licence', 'Insight AB', 1, 5, 54000],
  ['Payments gateway', 'PayCo', 3, 15, 88000],
  ['Office network', 'NetWorks', 7, 2, 18000]
].map(([name, vendor, month, day, cost], index) => ({
  _uid: `contract-${index}`,
  _publicId: `contract-${index}`,
  _name: name,
  vendor,
  contract_start: monthsFromNow(-24, 1),
  contract_end: monthsFromNow(month as number, day as number),
  annual_cost: { amount: cost, currency: 'SEK' }
}));

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(['entities', 'queryText', 'entities', WORKSPACE, QUERY], {
  ok: true,
  entities: contracts
});

const meta = {
  title: 'Widgets/Visualizations/Calendar',
  tags: ['dashboard', 'workspace-surface'],
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const MonthlyRenewals: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'renewals-calendar',
            'DateCalendar',
            {
              query: QUERY,
              dateFieldId: 'contract_end',
              period: 'month',
              periodCount: 12,
              sublabelFieldId: 'vendor',
              valueFieldId: 'annual_cost'
            },
            0,
            0,
            12,
            30
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WeeklyReviews: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'renewals-calendar-weeks',
            'DateCalendar',
            {
              query: QUERY,
              dateFieldId: 'contract_end',
              period: 'week',
              periodCount: 6
            },
            0,
            0,
            12,
            20
          )
        ]}
      />
    </StoryProviders>
  )
};

const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const caseClient = createStoryQueryClient();
const governanceCases = [
  ['case-1', 'entity.change-case', -2],
  ['case-2', 'entity.deprecation', 4],
  ['case-3', 'entity.change-case', 12],
  ['case-4', 'entity.change-case', 25]
].map(([id, caseKind, days], index) => ({
  id,
  caseKind,
  subjectType: 'entity',
  subjectId: `dataset-${index}`,
  status: 'open',
  payload: {},
  dueAt: daysFromNow(days as number)
})) as unknown as GovernanceCase[];
caseClient.setQueryData(
  governanceCasesQuery(WORKSPACE, { status: 'open', subjectType: 'entity' }).queryKey,
  governanceCases
);
governanceCases.forEach((governanceCase, index) =>
  caseClient.setQueryData(entityDetailQuery(WORKSPACE, governanceCase.subjectId).queryKey, {
    _uid: governanceCase.subjectId,
    _publicId: `DATA-00${index}`,
    _name: ['Customer master', 'Order history', 'Product catalogue', 'Payment events'][index],
    _schema: { id: 'story-data-entity', name: 'Data Entity' }
  } as unknown as EntityRecord)
);

const DATA_ENTITY_SCHEMAS = [
  {
    id: 'story-data-entity',
    name: 'Data Entity',
    icon: 'database',
    entity_count: 4,
    fields: []
  }
] as unknown as EntitySchema[];

/** Open governance cases placed on a six-week calendar by due date; overdue folds into this week. */
export const GovernanceCasesByDueWeek: Story = {
  render: () => (
    <StoryProviders client={caseClient} schemas={DATA_ENTITY_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'case-calendar',
            'DateCalendar',
            {
              cases: {
                schemaName: 'Data Entity',
                caseKinds: ['entity.change-case', 'entity.deprecation'],
                scope: 'workspace'
              },
              period: 'week',
              periodCount: 6
            },
            0,
            0,
            12,
            14
          )
        ]}
      />
    </StoryProviders>
  )
};
