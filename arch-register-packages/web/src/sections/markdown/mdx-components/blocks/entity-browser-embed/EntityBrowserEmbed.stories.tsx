import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import {
  encodeEntityBrowserEmbedConfig,
  type EntityBrowserEmbedConfig
} from './EntityBrowserEmbedCodec';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  DashboardStory,
  dashboardWidget
} from '../StorybookHarness';
import { entityKeys } from '../../../../../queries/entities';

const conditions: EntityBrowserEmbedConfig['conditions'] = [];
const browserConfig: EntityBrowserEmbedConfig = {
  q: '',
  conditions,
  sort: 'name',
  view: 'table',
  viewConfigs: {},
  projectScope: 'all'
};
const encodedConfig = encodeEntityBrowserEmbedConfig(browserConfig);
const entityQueryOptions = {
  schemaId: null,
  owner: null,
  lifecycle: null,
  q: '',
  conditions,
  entityQuery: null,
  assessmentId: undefined,
  projectId: undefined,
  projectScope: undefined,
  collectionId: undefined,
  view: 'full' as const,
  limit: undefined,
  offset: undefined,
  asOf: undefined,
  includePlannedChanges: true
};

const entities = [
  {
    _uid: 'entity-payments',
    _publicId: 'payments-api',
    _name: 'Payments API',
    _slug: 'payments-api',
    _description: 'Handles payment processing for the checkout flow.',
    _tags: ['critical'],
    _schema: { id: 'service', name: 'Service' },
    _owner: { id: 'platform', name: 'Platform' },
    _lifecycle: { id: 'active', name: 'Active' },
    _completeness: 82
  },
  {
    _uid: 'entity-orders',
    _publicId: 'orders-service',
    _name: 'Orders Service',
    _slug: 'orders-service',
    _description: 'Coordinates order creation and fulfillment.',
    _tags: [],
    _schema: { id: 'service', name: 'Service' },
    _owner: { id: 'commerce', name: 'Commerce' },
    _lifecycle: { id: 'planned', name: 'Planned' },
    _completeness: 64
  }
];

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(entityKeys.list(WORKSPACE, entityQueryOptions), {
  items: entities,
  total: entities.length
});
storyQueryClient.setQueryData(entityKeys.facets(WORKSPACE), {
  owner: [],
  lifecycle: [],
  schema: [],
  completeness: { below50: 0, below80: 1, above80: 1 }
});

const meta = {
  title: 'MDX Blocks/EntityBrowserEmbed',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiFiltered: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityBrowserEmbed config={encodedConfig} />
    </StoryProviders>
  )
};

export const WikiNoViewConfigured: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityBrowserEmbed />
    </StoryProviders>
  )
};

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget('entity-browser-embed', 'EntityBrowserEmbed', browserConfig, 0, 0, 6, 6)
        ]}
      />
    </StoryProviders>
  )
};
