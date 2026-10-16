import type { Meta, StoryObj } from '@storybook/react-vite';
import type { AuditLogEntry } from '@arch-register/api-types/auditContract';
import { EntityChangelog } from './EntityChangelog';
import {
  createStoryQueryClient,
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  frameControls,
  configDialogStory
} from '../../shared/mdx/StorybookHarness';
import { auditKeys } from '../../../queries/audit';

const entityId = 'entity-payments';

const entityEntries: AuditLogEntry[] = [
  {
    id: 'audit-payments-update',
    workspace: WORKSPACE,
    timestamp: '2026-07-29T09:30:00.000Z',
    user_id: 'user-platform',
    user_display_name: 'Alex Morgan',
    operation: 'update',
    entity_type: 'entity',
    entity_id: entityId,
    public_id: 'payments-api',
    entity_name: 'Payments API',
    entity_slug: 'payments-api',
    schema_id: 'service',
    changes: {
      old: { owner: 'Commerce' },
      new: { owner: 'Platform', lifecycle: 'active' }
    },
    metadata: {}
  },
  {
    id: 'audit-orders-create',
    workspace: WORKSPACE,
    timestamp: '2026-07-28T15:10:00.000Z',
    user_id: 'user-commerce',
    user_display_name: 'Jamie Lee',
    operation: 'create',
    entity_type: 'entity',
    entity_id: 'entity-orders',
    public_id: 'orders-service',
    entity_name: 'Orders Service',
    entity_slug: 'orders-service',
    schema_id: 'service',
    changes: { new: { name: 'Orders Service' } },
    metadata: {}
  },
  {
    id: 'audit-catalog-delete',
    workspace: WORKSPACE,
    timestamp: '2026-07-27T11:45:00.000Z',
    user_id: 'user-architecture',
    user_display_name: 'Taylor Smith',
    operation: 'delete',
    entity_type: 'entity',
    entity_id: 'entity-catalog',
    public_id: 'product-catalog',
    entity_name: 'Product Catalog',
    entity_slug: 'product-catalog',
    schema_id: 'service',
    changes: {},
    metadata: {}
  }
];

const entityQueryOptions = {
  entityType: 'entity',
  entityId,
  schemaId: undefined,
  owner: undefined,
  lifecycle: undefined,
  startDate: undefined,
  limit: 10
};

const schemaQueryOptions = {
  entityType: 'entity',
  entityId: undefined,
  schemaId: 'service',
  owner: undefined,
  lifecycle: undefined,
  startDate: undefined,
  limit: 10
};

// A dashboard widget needs a filter (see the config schema), so the empty state uses a valid
// config - limit 5 - whose seeded result is empty.
const emptyQueryOptions = { ...schemaQueryOptions, limit: 5 };

const entityHistoryEntries = entityEntries.filter(entry => entry.entity_id === entityId);

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(auditKeys.log(WORKSPACE, entityQueryOptions), entityHistoryEntries);
storyQueryClient.setQueryData(auditKeys.log(WORKSPACE, schemaQueryOptions), entityEntries);
storyQueryClient.setQueryData(auditKeys.log(WORKSPACE, emptyQueryOptions), []);

const meta = {
  title: 'Widgets/Data views/Entity changelog',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages and dashboards (workspace and project): A feed of recent changes. Scope it to one entity with `entityId`, or to a set of entities by schema, owner and lifecycle; `since` and `limit` control the time window and the number of entries. Use it to answer "what has changed lately?" on an entity page or an overview.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const EntityHistory: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChangelog config={{ entityId, limit: '10' }} />
    </StoryProviders>
  )
};

export const SchemaHistory: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChangelog config={{ schema: 'service', limit: '10' }} />
    </StoryProviders>
  )
};

export const NoFilter: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChangelog config={{}} />
    </StoryProviders>
  )
};

export const Default: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-changelog',
            'EntityChangelog',
            { entityId, limit: '10' },
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

export const Empty: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-changelog-empty',
            'EntityChangelog',
            { schema: 'service', limit: '5' },
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
  args: { showFrame: true }
};

export const ConfigDialog = configDialogStory('EntityChangelog');
