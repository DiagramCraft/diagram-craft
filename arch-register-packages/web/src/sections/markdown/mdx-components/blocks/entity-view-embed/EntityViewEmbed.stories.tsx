import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityViewEmbed } from './EntityViewEmbed';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  queryClient
} from '../StorybookHarness';
import { entityKeys } from '../../../../../queries/entities';
import { viewKeys } from '../../../../../queries/views';

const savedViewFilters = {
  schemaId: 'service',
  root: { kind: 'and' as const, children: [] }
};

const savedView = {
  id: 'view-services',
  workspaceId: WORKSPACE,
  scope: 'workspace' as const,
  projectId: null,
  projectScope: null,
  name: 'Services',
  description: 'Workspace services',
  isAdminView: false,
  viewMode: 'table' as const,
  filters: savedViewFilters,
  config: {
    sort: 'name',
    table: { fieldIds: ['_description', '_owner', '_lifecycle'] }
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
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
  }
];

queryClient.setQueryData(viewKeys.list(WORKSPACE), [savedView]);
queryClient.setQueryData(
  entityKeys.list(WORKSPACE, { entityQuery: savedViewFilters, view: 'full', limit: 100 }),
  { items: entities, total: entities.length }
);

const meta = {
  title: 'MDX Blocks/EntityViewEmbed',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiConfigured: Story = {
  render: () => (
    <StoryProviders>
      <EntityViewEmbed viewId="view-services" />
    </StoryProviders>
  )
};

export const WikiNoView: Story = {
  render: () => (
    <StoryProviders>
      <EntityViewEmbed />
    </StoryProviders>
  )
};

export const WikiMissingView: Story = {
  render: () => (
    <StoryProviders>
      <EntityViewEmbed viewId="deleted-view" />
    </StoryProviders>
  )
};

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget('saved-view', 'EntityViewEmbed', { viewId: 'view-services' }, 0, 0, 3, 2)
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
            'saved-view-wide',
            'EntityViewEmbed',
            { viewId: 'view-services' },
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
            'saved-view-large',
            'EntityViewEmbed',
            { viewId: 'view-services' },
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
