import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';

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
  title: 'Dashboard Widgets/DateCalendar',
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
            { query: QUERY, dateFieldId: 'contract_end', period: 'week', periodCount: 6 },
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
