import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityChart } from './EntityChart';
import { createStoryQueryClient, StoryProviders, WORKSPACE } from '../StorybookHarness';
import { entityKeys } from '../../../../../queries/entities';

const storyQueryClient = createStoryQueryClient();

const chartQueryOptions = {
  schemaId: 'service',
  owner: undefined,
  lifecycle: undefined,
  view: 'full' as const,
  limit: 500
};

storyQueryClient.setQueryData(entityKeys.list(WORKSPACE, chartQueryOptions), {
  items: [
    {
      _uid: 'entity-payments',
      _publicId: 'payments-api',
      _name: 'Payments API',
      _slug: 'payments-api',
      _schema: { id: 'service', name: 'Service' },
      _owner: { id: 'platform', name: 'Platform' },
      _lifecycle: { id: 'active', name: 'Active' }
    },
    {
      _uid: 'entity-orders',
      _publicId: 'orders-service',
      _name: 'Orders Service',
      _slug: 'orders-service',
      _schema: { id: 'service', name: 'Service' },
      _owner: { id: 'commerce', name: 'Commerce' },
      _lifecycle: { id: 'active', name: 'Active' }
    },
    {
      _uid: 'entity-catalog',
      _publicId: 'product-catalog',
      _name: 'Product Catalog',
      _slug: 'product-catalog',
      _schema: { id: 'service', name: 'Service' },
      _owner: { id: 'platform', name: 'Platform' },
      _lifecycle: { id: 'planned', name: 'Planned' }
    },
    {
      _uid: 'entity-notifications',
      _publicId: 'notifications',
      _name: 'Notifications',
      _slug: 'notifications',
      _schema: { id: 'service', name: 'Service' },
      _owner: null,
      _lifecycle: null
    }
  ],
  total: 4
});

storyQueryClient.setQueryData(
  entityKeys.list(WORKSPACE, { ...chartQueryOptions, lifecycle: 'active' }),
  {
    items: [
      {
        _uid: 'entity-payments',
        _publicId: 'payments-api',
        _name: 'Payments API',
        _slug: 'payments-api',
        _schema: { id: 'service', name: 'Service' },
        _owner: { id: 'platform', name: 'Platform' },
        _lifecycle: { id: 'active', name: 'Active' }
      },
      {
        _uid: 'entity-orders',
        _publicId: 'orders-service',
        _name: 'Orders Service',
        _slug: 'orders-service',
        _schema: { id: 'service', name: 'Service' },
        _owner: { id: 'commerce', name: 'Commerce' },
        _lifecycle: { id: 'active', name: 'Active' }
      }
    ],
    total: 2
  }
);

const meta = {
  title: 'MDX Blocks/EntityChart',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiDonutByLifecycle: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChart schema="service" groupBy="lifecycle" chartType="donut" />
    </StoryProviders>
  )
};

export const WikiBarByOwner: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChart schema="service" groupBy="owner" chartType="bar" />
    </StoryProviders>
  )
};

export const WikiFilteredByLifecycle: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChart schema="service" lifecycle="active" groupBy="owner" />
    </StoryProviders>
  )
};

export const WikiNoFilters: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChart />
    </StoryProviders>
  )
};
