import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';

const QUERY = 'schema:"Vendor"';

const schemas = [
  {
    id: 'vendor',
    name: 'Vendor',
    icon: 'building',
    entity_count: 6,
    fields: [
      {
        id: 'cost_centre',
        name: 'Cost Centre',
        type: 'select',
        options: [
          { value: 'engineering', label: 'Engineering' },
          { value: 'sales', label: 'Sales' },
          { value: 'operations', label: 'Operations' }
        ]
      }
    ]
  }
] as unknown as EntitySchema[];

const vendors = [
  ['Acme Cloud', 'engineering', 240000],
  ['Insight AB', 'engineering', 54000],
  ['PayCo', 'operations', 88000],
  ['NetWorks', 'operations', 18000],
  ['LeadGen', 'sales', 36000],
  ['Unassigned Ltd', undefined, 6000]
].map(([name, costCentre, amount], index) => ({
  _uid: `vendor-${index}`,
  _publicId: `VND-${index}`,
  _name: name,
  _schemaId: 'vendor',
  cost_centre: costCentre,
  spend: { amount, currency: 'SEK' }
}));

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(['entities', 'queryText', 'entities', WORKSPACE, QUERY], {
  ok: true,
  entities: vendors
});

const meta = {
  title: 'Widgets/Data views/Roll-up table',
  tags: ['dashboard', 'workspace-surface', 'project-surface'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Sums a number or currency field over the records of a query and ranks the result, either one row per record or grouped by another field. Rows can show a bar relative to the largest row, the share of the total and the number of records, and a total row can be added. Use it for "spend by vendor" or "cost by cost centre" style questions.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpendByVendor: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={schemas}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'spend-by-vendor',
            'GroupedRollupTable',
            {
              query: QUERY,
              valueFieldId: 'spend',
              valueLabel: 'Spend / yr',
              showBar: true,
              showPercent: true
            },
            0,
            0,
            12,
            22
          )
        ]}
      />
    </StoryProviders>
  )
};

export const SpendByCostCentre: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={schemas}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'spend-by-cost-centre',
            'GroupedRollupTable',
            {
              query: QUERY,
              groupFieldId: 'cost_centre',
              valueFieldId: 'spend',
              valueLabel: 'Spend / yr',
              showBar: true,
              showPercent: true,
              showCount: true
            },
            0,
            0,
            12,
            18
          )
        ]}
      />
    </StoryProviders>
  )
};

export const Minimal: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient} schemas={schemas}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'spend-minimal',
            'GroupedRollupTable',
            { query: QUERY, groupFieldId: 'cost_centre', valueFieldId: 'spend', showTotal: false },
            0,
            0,
            6,
            14
          )
        ]}
      />
    </StoryProviders>
  )
};
