import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';

const QUERY = 'schema:"Contract"';

const monthsFromNow = (months: number): string => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12).toISOString().slice(0, 10);
};

const contracts = [
  ['Cloud hosting', 'Acme Cloud', -30, 3, true, 90, 120000],
  ['Support plan', 'Acme Cloud', -12, 12, false, 30, 24000],
  ['Analytics licence', 'Insight AB', -6, 18, true, 60, 54000],
  ['Payments gateway', 'PayCo', 0, 36, true, 180, 88000]
].map(([name, vendor, start, end, auto, notice, cost], index) => ({
  _uid: `contract-${index}`,
  _publicId: `contract-${index}`,
  _name: name,
  vendor,
  contract_start: monthsFromNow(start as number),
  contract_end: monthsFromNow(end as number),
  auto_renew: auto,
  notice_period_days: notice,
  annual_cost: { amount: cost, currency: 'SEK' }
}));

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(['entities', 'queryText', 'entities', WORKSPACE, QUERY], {
  ok: true,
  entities: contracts
});

const meta = {
  title: 'Dashboard Widgets/DateRangeTimeline',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContractTerms: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'contract-timeline',
            'DateRangeTimeline',
            {
              query: QUERY,
              startFieldId: 'contract_start',
              endFieldId: 'contract_end',
              sublabelFieldId: 'vendor',
              valueFieldId: 'annual_cost',
              markerOffsetFieldId: 'notice_period_days',
              markerWhenFieldId: 'auto_renew'
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
