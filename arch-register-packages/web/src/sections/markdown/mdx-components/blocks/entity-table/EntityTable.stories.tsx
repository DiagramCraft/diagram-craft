import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityTable } from './EntityTable';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  queryClient
} from '../StorybookHarness';
import { entityKeys } from '../../../../../queries/entities';

const tableQueryOptions = {
  schemaId: 'service',
  owner: undefined,
  lifecycle: undefined,
  projectId: undefined,
  projectScope: undefined,
  view: 'full' as const,
  limit: 10
};

const entities = [
  {
    _uid: 'entity-payments',
    _publicId: 'payments-api',
    _name: 'Payments API',
    _slug: 'payments-api',
    _description: 'Handles payment processing for the checkout flow.',
    _schema: { id: 'service', name: 'Service' },
    _owner: { id: 'platform', name: 'Platform' },
    _lifecycle: { id: 'active', name: 'Active' }
  },
  {
    _uid: 'entity-orders',
    _publicId: 'orders-service',
    _name: 'Orders Service',
    _slug: 'orders-service',
    _description: 'Coordinates order creation and fulfillment.',
    _schema: { id: 'service', name: 'Service' },
    _owner: { id: 'commerce', name: 'Commerce' },
    _lifecycle: { id: 'planned', name: 'Planned' }
  },
  {
    _uid: 'entity-catalog',
    _publicId: 'product-catalog',
    _name: 'Product Catalog',
    _slug: 'product-catalog',
    _description: 'Provides product and pricing information.',
    _schema: { id: 'service', name: 'Service' },
    _owner: null,
    _lifecycle: null
  }
];

queryClient.setQueryData(entityKeys.list(WORKSPACE, tableQueryOptions), {
  items: entities,
  total: entities.length
});

const meta = {
  title: 'MDX Blocks/EntityTable',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiFiltered: Story = {
  render: () => (
    <StoryProviders>
      <EntityTable schema="service" limit="10" />
    </StoryProviders>
  )
};

export const WikiEmpty: Story = {
  render: () => (
    <StoryProviders>
      <EntityTable />
    </StoryProviders>
  )
};

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-table',
            'EntityTable',
            { schema: 'service', limit: 10 },
            0,
            0,
            3,
            2
          )
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardWide: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-table-wide',
            'EntityTable',
            { schema: 'service', limit: 10 },
            0,
            0,
            6,
            4
          )
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardLarge: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-table-large',
            'EntityTable',
            { schema: 'service', limit: 10 },
            0,
            0,
            12,
            6
          )
        ]}
      />
    </StoryProviders>
  )
};
