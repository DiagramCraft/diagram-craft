import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient
} from '../../../sections/markdown/mdx-components/blocks/StorybookHarness';
import { entityBlastRadiusAggregateQuery } from '../../../queries/entityTraversal';
import { entityDetailQuery } from '../../../queries/entities';
import { ApiBlastRadiusPanel } from './ApiBlastRadiusPanel';

const API_ID = 'api-1';
const PROVIDERS_RELATION_SCHEMA_ID = 'provides-api-relation';
const CONSUMERS_RELATION_SCHEMA_ID = 'consumes-api-relation';
const MAX_DEPTH = 2;

const paths = [
  {
    id: 'provides-api',
    steps: [
      {
        kind: 'unboundTypedRelation' as const,
        relationSchemaId: PROVIDERS_RELATION_SCHEMA_ID,
        direction: 'both' as const
      }
    ]
  },
  {
    id: 'consumes-api',
    steps: [
      {
        kind: 'unboundTypedRelation' as const,
        relationSchemaId: CONSUMERS_RELATION_SCHEMA_ID,
        direction: 'both' as const
      }
    ]
  }
];

const schemas = [
  { id: 'service', name: 'Service', icon: 'server', entity_count: 12, fields: [] }
] as unknown as EntitySchema[];

const lifecycleStates = [
  { id: 'active', label: 'Active', color: '#22c55e' },
  { id: 'planned', label: 'Planned', color: '#f59e0b' }
] as WorkspaceLifecycleState[];

/**
 * Proves `ApiBlastRadiusPanel` (#3320, the shape #3458's panels were modeled on) renders from a
 * plain prop object with zero router involvement — see #3459. `workspaceId`/`apiId`/relation-schema
 * ids/`schemas`/`lifecycleStates` all arrive as props; the Screen (`ApiIntegrationCatalogImpactScreen.tsx`)
 * is the one that reads `useParams`/`useSearch` to resolve them.
 */
const meta = {
  title: 'API & Integration Catalog/BlastRadiusPanel',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  render: () => {
    const client = createStoryQueryClient();
    client.setQueryData(
      entityBlastRadiusAggregateQuery(
        WORKSPACE,
        { kind: 'entity', entityId: API_ID },
        paths,
        MAX_DEPTH
      ).queryKey,
      {
        entities: [
          {
            entityId: 'provider-1',
            entityName: 'Payments Gateway',
            entitySlug: 'payments-gateway',
            schemaId: 'service',
            schemaName: 'Service',
            ownerId: null,
            lifecycleState: 'active',
            criticality: null,
            depth: 1,
            rank: 1,
            paths: [
              {
                rootId: API_ID,
                pathId: 'provides-api',
                depth: 1,
                provenance: [
                  { context: 'entity', id: API_ID, schemaId: 'story-api-schema' },
                  { context: 'entity', id: 'provider-1', schemaId: 'service' }
                ]
              }
            ]
          },
          {
            entityId: 'consumer-1',
            entityName: 'Checkout Service',
            entitySlug: 'checkout-service',
            schemaId: 'service',
            schemaName: 'Service',
            ownerId: null,
            lifecycleState: 'planned',
            criticality: null,
            depth: 1,
            rank: 2,
            paths: [
              {
                rootId: API_ID,
                pathId: 'consumes-api',
                depth: 1,
                provenance: [
                  { context: 'entity', id: API_ID, schemaId: 'story-api-schema' },
                  { context: 'entity', id: 'consumer-1', schemaId: 'service' }
                ]
              }
            ]
          }
        ],
        groups: { lifecycle: [], owner: [], schema: [], criticality: [] }
      }
    );
    client.setQueryData(entityDetailQuery(WORKSPACE, API_ID).queryKey, {
      _uid: API_ID,
      _publicId: 'API-001',
      _name: 'Payments API'
    } as unknown as EntityRecord);
    client.setQueryData(entityDetailQuery(WORKSPACE, 'provider-1').queryKey, {
      _uid: 'provider-1',
      _publicId: 'SVC-001',
      _name: 'Payments Gateway'
    } as unknown as EntityRecord);
    client.setQueryData(entityDetailQuery(WORKSPACE, 'consumer-1').queryKey, {
      _uid: 'consumer-1',
      _publicId: 'SVC-002',
      _name: 'Checkout Service'
    } as unknown as EntityRecord);

    return (
      <StoryProviders client={client}>
        <ApiBlastRadiusPanel
          workspaceId={WORKSPACE}
          apiId={API_ID}
          providersRelationSchemaId={PROVIDERS_RELATION_SCHEMA_ID}
          consumersRelationSchemaId={CONSUMERS_RELATION_SCHEMA_ID}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
        />
      </StoryProviders>
    );
  }
};

export const NoRelationFieldsConfigured: Story = {
  render: () => (
    <StoryProviders client={createStoryQueryClient()}>
      <ApiBlastRadiusPanel
        workspaceId={WORKSPACE}
        apiId={API_ID}
        providersRelationSchemaId={null}
        consumersRelationSchemaId={null}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
      />
    </StoryProviders>
  )
};
