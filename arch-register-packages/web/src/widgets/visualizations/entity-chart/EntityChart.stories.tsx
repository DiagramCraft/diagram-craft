import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityChart } from './EntityChart';
import {
  createStoryQueryClient,
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  frameControls,
  configDialogStory
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

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
  title: 'Widgets/Visualizations/Entity chart',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages and workspace dashboards: A live chart of entities grouped by a field (lifecycle, owner or schema), shown as a donut or a bar chart. Filter the entities by schema, owner and lifecycle. Use it to show the distribution of the catalog on a wiki page or a dashboard.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DonutByLifecycle: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChart config={{ schema: 'service', groupBy: 'lifecycle', chartType: 'donut' }} />
    </StoryProviders>
  )
};

export const BarByOwner: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChart config={{ schema: 'service', groupBy: 'owner', chartType: 'bar' }} />
    </StoryProviders>
  )
};

export const FilteredByLifecycle: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChart
        config={{
          schema: 'service',
          lifecycle: 'active',
          groupBy: 'owner',
          chartType: 'donut'
        }}
      />
    </StoryProviders>
  )
};

export const NoFilters: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChart config={{ groupBy: 'lifecycle', chartType: 'donut' }} />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-chart',
            'EntityChart',
            { schema: 'service', groupBy: 'lifecycle', chartType: 'donut' },
            0,
            0,
            6,
            24
          )
        ]}
      />
    </StoryProviders>
  ),
  args: { frameStyle: 'header' }
};

export const ConfigDialog = configDialogStory('EntityChart');
