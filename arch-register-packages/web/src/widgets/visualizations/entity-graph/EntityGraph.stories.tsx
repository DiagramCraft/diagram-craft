import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityGraph } from './EntityGraph';
import {
  createStoryQueryClient,
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  dashboardWidget,
  frameControls
} from '../../shared/mdx/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

const rootEntityId = 'entity-payments';
const dependencyEntityId = 'entity-orders';
const platformEntityId = 'entity-platform';

const rootEntity = {
  _uid: rootEntityId,
  _publicId: 'payments-api',
  _name: 'Payments API',
  _slug: 'payments-api',
  _description: 'Handles payment processing for the checkout flow.',
  _schema: { id: 'service', name: 'Service', icon: 'server' },
  _owner: { id: 'platform', name: 'Platform' },
  _lifecycle: { id: 'active', name: 'Active' }
};

const outgoingRelation = {
  entityId: dependencyEntityId,
  publicId: 'orders-service',
  entitySlug: 'orders-service',
  entityName: 'Orders Service',
  entitySchemaId: 'service',
  fieldName: 'dependsOn',
  fieldPredicate: 'depends on',
  kind: 'reference' as const
};

const incomingRelation = {
  entityId: platformEntityId,
  publicId: 'checkout-platform',
  entitySlug: 'checkout-platform',
  entityName: 'Checkout Platform',
  entitySchemaId: 'service',
  fieldName: 'usesPayments',
  fieldPredicate: 'uses',
  kind: 'reference' as const
};

const relationData = {
  [rootEntityId]: { outgoing: [outgoingRelation], incoming: [incomingRelation] },
  [dependencyEntityId]: { outgoing: [], incoming: [] },
  [platformEntityId]: { outgoing: [], incoming: [] }
};

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryDefaults(entityKeys.workspaceBatchRelations(WORKSPACE), {
  staleTime: Infinity
});
storyQueryClient.setQueryData(entityKeys.detail(WORKSPACE, rootEntityId), rootEntity);
storyQueryClient.setQueryData(entityKeys.batchRelations(WORKSPACE, [rootEntityId]), {
  [rootEntityId]: relationData[rootEntityId]
});
storyQueryClient.setQueryData(
  entityKeys.batchRelations(WORKSPACE, [dependencyEntityId, rootEntityId, platformEntityId]),
  relationData
);
storyQueryClient.setQueryData(
  entityKeys.batchRelations(WORKSPACE, [dependencyEntityId, rootEntityId]),
  {
    [rootEntityId]: relationData[rootEntityId],
    [dependencyEntityId]: relationData[dependencyEntityId]
  }
);

const meta = {
  title: 'Widgets/Visualizations/Entity graph',
  tags: ['mdx', 'block', 'dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wiki pages and dashboards (workspace and project): A clickable graph of the dependencies and relations around one entity. Choose how many hops (`depth`) and which `direction` to follow: upstream, downstream or both. Works best at 6x4 or larger.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothDirections: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityGraph config={{ entityId: rootEntityId, depth: 2, direction: 'both' }} />
    </StoryProviders>
  )
};

export const UpstreamOnly: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityGraph config={{ entityId: rootEntityId, depth: 1, direction: 'upstream' }} />
    </StoryProviders>
  )
};

export const MissingId: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <EntityGraph config={{ entityId: '' }} />
    </StoryProviders>
  )
};

export const Default: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'entity-graph-large',
            'EntityGraph',
            { entityId: rootEntityId, depth: 2, direction: 'both' },
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
