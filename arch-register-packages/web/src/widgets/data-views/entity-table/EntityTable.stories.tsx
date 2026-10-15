import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityTable } from './EntityTable';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  queryClient,
  frameControls
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

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
  title: 'Widgets/Data views/Entity table',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages and dashboards (workspace and project): A table of entities matching filters you define (schema, owner and lifecycle), with a `limit` on the number of rows. It is the simplest way to show a fixed, readable list of entities. For richer filtering, sorting and columns use the Entity browser.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filtered: Story = {
  render: () => (
    <StoryProviders>
      <EntityTable config={{ schema: 'service', limit: 10 }} />
    </StoryProviders>
  )
};

export const Empty: Story = {
  render: () => (
    <StoryProviders>
      <EntityTable config={{}} />
    </StoryProviders>
  )
};

export const Default: Story = {
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

export const WithFrame: Story = {
  ...Default,
  args: { showFrame: true }
};
