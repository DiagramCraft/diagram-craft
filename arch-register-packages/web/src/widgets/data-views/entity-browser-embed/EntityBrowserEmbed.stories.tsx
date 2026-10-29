import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityBrowserEmbed } from './EntityBrowserEmbed';
import type { EntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  DashboardStory,
  dashboardWidget,
  frameControls,
  configDialogStory
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

const conditions: EntityBrowserEmbedConfig['conditions'] = [];
const browserConfig: EntityBrowserEmbedConfig = {
  q: '',
  conditions,
  sort: 'name',
  view: 'table',
  viewConfigs: {},
  projectScope: 'all'
};
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
  includePlannedChanges: true,
  includeUsageCount: false
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
// The interactive embed pages server-side by name (default page size 200, first page).
storyQueryClient.setQueryData(
  entityKeys.list(WORKSPACE, { ...entityQueryOptions, limit: 200, offset: 0 }),
  { items: entities, total: entities.length }
);
storyQueryClient.setQueryData(entityKeys.facets(WORKSPACE), {
  owner: [],
  lifecycle: [],
  schema: [],
  completeness: { below50: 0, below80: 1, above80: 1 }
});

const meta = {
  title: 'Widgets/Data views/Entity browser',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages and dashboards (workspace and project): A live list of entities with your own filters, sorting and columns, shown as a table, cards, or a map. In its static form it renders a fixed result, which is what wiki pages publish; with `interactive` set it also provides search and pagination. Use it for flexible catalog views that would otherwise need a saved view.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Embedded: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityBrowserEmbed config={browserConfig} />
    </StoryProviders>
  )
};

export const Interactive: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityBrowserEmbed config={{ ...browserConfig, interactive: true }} />
    </StoryProviders>
  )
};

export const Default: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget('entity-browser-embed', 'EntityBrowserEmbed', browserConfig, 0, 0, 12, 12)
        ]}
      />
    </StoryProviders>
  )
};

export const InteractiveTile: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-browser-embed',
            'EntityBrowserEmbed',
            { ...browserConfig, interactive: true },
            0,
            0,
            12,
            12
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...Default,
  args: { frameStyle: 'header' }
};

export const ConfigDialog = configDialogStory('EntityBrowserEmbed');
