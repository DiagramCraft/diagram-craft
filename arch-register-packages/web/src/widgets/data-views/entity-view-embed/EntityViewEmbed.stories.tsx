import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityViewEmbed } from './EntityViewEmbed';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  queryClient,
  frameControls
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';
import { viewKeys } from '../../../queries/views';

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
  title: 'Widgets/Data views/Saved view',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages and dashboards (workspace and project): A live copy of a saved entity view. The embed always shows the view as it is currently defined, so a view that someone has already set up can be reused in a page or on a dashboard without being rebuilt.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// An empty viewId is not a valid dashboard config, so this state only occurs in a wiki block and
// is rendered bare, without a frame to toggle.
export const NoView: Story = {
  argTypes: { showFrame: { control: false } },
  render: () => (
    <StoryProviders>
      <EntityViewEmbed config={{ viewId: '' }} />
    </StoryProviders>
  )
};

export const MissingView: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'saved-view-missing',
            'EntityViewEmbed',
            { viewId: 'deleted-view' },
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

export const Default: Story = {
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
            18
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
