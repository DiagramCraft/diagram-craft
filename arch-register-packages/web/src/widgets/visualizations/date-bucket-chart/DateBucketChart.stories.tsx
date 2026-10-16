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
  title: 'Widgets/Visualizations/Date bar chart',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: A bar chart with one bar per month for a date field, showing either record counts or the sum of a number or currency field. Use it to see when renewals, expiries or reviews are concentrated. Overdue records can be folded into the current month, and months with something due soon are drawn in an urgent colour.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContractCostByEndMonth: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'contract-end-chart',
            'DateBucketChart',
            {
              query: QUERY,
              dateFieldId: 'contract_end',
              measureFieldId: 'annual_cost',
              bucketCount: 12,
              urgentWithinDays: 60
            },
            0,
            0,
            8,
            12
          )
        ]}
      />
    </StoryProviders>
  )
};

export const RecordCounts: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'contract-count-chart',
            'DateBucketChart',
            { query: QUERY, dateFieldId: 'contract_end', bucketCount: 12 },
            0,
            0,
            8,
            12
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...ContractCostByEndMonth,
  args: { showFrame: true }
};

export const ConfigDialog = configDialogStory('DateBucketChart');
