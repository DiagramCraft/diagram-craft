import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient
} from '../../../sections/markdown/mdx-components/blocks/StorybookHarness';
import { entitiesQuery } from '../../../queries/entities';
import { entityArtifactsQuery } from '../../../queries/artifacts';
import { ApiIntegrationCatalogMostConsumedPanel } from './ApiIntegrationCatalogMostConsumedPanel';
import {
  API_SCHEMA_ID,
  seedApiCapabilityConfig,
  seedDataFlowRelationSchema,
  seedSchemas
} from './apiIntegrationCatalogStoryFixtures';

/**
 * Proves `ApiIntegrationCatalogMostConsumedPanel` (#3458) renders from a plain prop object with
 * zero router involvement — see #3459. `apiSchemaId` arrives as a resolved id prop, mirroring
 * `ApiIntegrationCatalogOverviewScreen.tsx`'s `apiConfig.apiSchemaId`.
 */
const meta = {
  title: 'API & Integration Catalog/MostConsumedPanel',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  render: () => {
    const client = createStoryQueryClient();
    seedApiCapabilityConfig(client);
    seedSchemas(client);
    seedDataFlowRelationSchema(client, false);
    client.setQueryData(
      entitiesQuery(WORKSPACE, { schemaId: API_SCHEMA_ID, view: 'full', limit: 500 }).queryKey,
      {
        items: [
          {
            _uid: 'api-1',
            _publicId: 'API-001',
            _name: 'Payments API',
            _schema: { id: API_SCHEMA_ID, name: 'API' },
            _owner: { id: 'team-payments', name: 'Payments Team' }
          },
          {
            _uid: 'api-2',
            _publicId: 'API-002',
            _name: 'Orders API',
            _schema: { id: API_SCHEMA_ID, name: 'API' },
            _owner: null
          }
        ] as unknown as EntityRecord[],
        total: 2
      }
    );
    type ArtifactCollection = NonNullable<
      Awaited<ReturnType<NonNullable<ReturnType<typeof entityArtifactsQuery>['queryFn']>>>
    >;
    const noArtifacts = {
      entity: {},
      artifacts: [],
      status: 'not_configured'
    } as unknown as ArtifactCollection;
    client.setQueryData(entityArtifactsQuery(WORKSPACE, 'api-1').queryKey, noArtifacts);
    client.setQueryData(entityArtifactsQuery(WORKSPACE, 'api-2').queryKey, noArtifacts);

    return (
      <StoryProviders client={client}>
        <ApiIntegrationCatalogMostConsumedPanel
          workspaceId={WORKSPACE}
          apiSchemaId={API_SCHEMA_ID}
          onOpenApi={() => {}}
          onViewCatalog={() => {}}
        />
      </StoryProviders>
    );
  }
};

export const Empty: Story = {
  render: () => {
    const client = createStoryQueryClient();
    seedApiCapabilityConfig(client);
    seedSchemas(client);
    seedDataFlowRelationSchema(client, false);
    client.setQueryData(
      entitiesQuery(WORKSPACE, { schemaId: API_SCHEMA_ID, view: 'full', limit: 500 }).queryKey,
      { items: [], total: 0 }
    );

    return (
      <StoryProviders client={client}>
        <ApiIntegrationCatalogMostConsumedPanel
          workspaceId={WORKSPACE}
          apiSchemaId={API_SCHEMA_ID}
          onOpenApi={() => {}}
          onViewCatalog={() => {}}
        />
      </StoryProviders>
    );
  }
};
