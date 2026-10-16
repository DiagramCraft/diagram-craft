import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
  frameControls,
  configDialogStory
} from '../../shared/mdx/StorybookHarness';

const QUERY = 'schema:"Contract"';

const monthsFromNow = (months: number, day: number): string => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + months, day, 12).toISOString().slice(0, 10);
};

const contracts = [
  ['Cloud hosting', 'Acme Cloud', 1, 12, 120000],
  ['Support plan', 'Acme Cloud', 2, 28, 24000],
  ['Analytics licence', 'Insight AB', 4, 5, 54000],
  ['Payments gateway', 'PayCo', 5, 15, 88000],
  ['Office network', 'NetWorks', 9, 2, 18000],
  ['Monitoring suite', 'Insight AB', 9, 20, 36000]
].map(([name, vendor, month, day, cost], index) => ({
  _uid: `contract-${index}`,
  _publicId: `contract-${index}`,
  _name: name,
  vendor,
  contract_end: monthsFromNow(month as number, day as number),
  annual_cost: { amount: cost, currency: 'SEK' }
}));

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(['entities', 'queryText', 'entities', WORKSPACE, QUERY], {
  ok: true,
  entities: contracts
});

const meta = {
  title: 'Widgets/Data views/Upcoming by date',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: Lists records ordered by an upcoming date, each with a countdown that turns orange and then red as the date approaches. Optionally show a sublabel and a value, restrict the list to a window of days, and include records that are already overdue. Use it for renewals, expiries and reviews that are due.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContractRenewals: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'upcoming-renewals',
            'UpcomingByDate',
            {
              query: QUERY,
              dateFieldId: 'contract_end',
              sublabelFieldId: 'vendor',
              valueFieldId: 'annual_cost',
              limit: 5,
              critWithinDays: 30,
              warnWithinDays: 90
            },
            0,
            0,
            5,
            14
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...ContractRenewals,
  args: { showFrame: true }
};

export const ConfigDialog = configDialogStory('UpcomingByDate');
