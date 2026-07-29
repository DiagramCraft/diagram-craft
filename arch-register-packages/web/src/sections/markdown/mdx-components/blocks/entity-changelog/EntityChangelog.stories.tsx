import type { Meta, StoryObj } from '@storybook/react-vite';
import type { AuditLogEntry } from '@arch-register/api-types/auditContract';
import { EntityChangelog } from './EntityChangelog';
import {
  createStoryQueryClient,
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget
} from '../StorybookHarness';
import { auditKeys } from '../../../../../queries/audit';

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

const entityHistoryEntries = entityEntries.filter(entry => entry.entity_id === entityId);

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(auditKeys.log(WORKSPACE, entityQueryOptions), entityHistoryEntries);
storyQueryClient.setQueryData(auditKeys.log(WORKSPACE, schemaQueryOptions), entityEntries);

const meta = {
  title: 'MDX Blocks/EntityChangelog',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiEntityHistory: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChangelog id={entityId} limit="10" />
    </StoryProviders>
  )
};

export const WikiSchemaHistory: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChangelog schema="service" limit="10" />
    </StoryProviders>
  )
};

export const WikiNoFilter: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityChangelog />
    </StoryProviders>
  )
};

export const DashboardDefault: Story = {
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
            6,
            4
          )
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardEmpty: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[dashboardWidget('entity-changelog-empty', 'EntityChangelog', {}, 0, 0, 6, 4)]}
      />
    </StoryProviders>
  )
};
