import type { Meta, StoryObj } from '@storybook/react-vite';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient
} from '../../../sections/markdown/mdx-components/blocks/StorybookHarness';
import { governanceCasesQuery } from '../../../queries/governance';
import { entityDetailQuery } from '../../../queries/entities';
import { relationsQuery } from '../../../queries/relations';
import { ApiIntegrationCatalogStatTiles } from './ApiIntegrationCatalogStatTiles';
import {
  API_SCHEMA_ID,
  DATA_FLOW_RELATION_SCHEMA_ID,
  seedApiCapabilityConfig,
  seedDataFlowRelationSchema,
  seedSchemas
} from './apiIntegrationCatalogStoryFixtures';

/**
 * Proves `ApiIntegrationCatalogStatTiles` (#3458) renders from a plain `workspaceId` prop with zero
 * router involvement — see #3459.
 */
const meta = {
  title: 'API & Integration Catalog/StatTiles',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const client = createStoryQueryClient();
    seedApiCapabilityConfig(client);
    seedSchemas(client);
    seedDataFlowRelationSchema(client, true);
    client.setQueryData(
      governanceCasesQuery(WORKSPACE, { status: 'open', subjectType: 'entity' }).queryKey,
      [
        {
          id: 'case-1',
          caseKind: 'entity.change-case',
          subjectType: 'entity',
          subjectId: 'api-1',
          status: 'open',
          payload: { kind: 'change-proposal', revisionId: 'rev-1' },
          dueAt: null
        }
      ] as unknown as GovernanceCase[]
    );
    client.setQueryData(entityDetailQuery(WORKSPACE, 'api-1').queryKey, {
      _uid: 'api-1',
      _publicId: 'API-001',
      _name: 'Payments API',
      _schema: { id: API_SCHEMA_ID, name: 'API' }
    } as unknown as EntityRecord);
    client.setQueryData(
      relationsQuery(WORKSPACE, { schemaId: DATA_FLOW_RELATION_SCHEMA_ID, limit: 500 }).queryKey,
      {
        items: [
          {
            _uid: 'relation-1',
            _in: { id: 'checkout-service', name: 'Checkout Service' },
            _out: { id: 'payments-service', name: 'Payments Service' },
            cross_boundary: 'cross-boundary',
            data_classification: 'sensitive'
          },
          {
            _uid: 'relation-2',
            _in: { id: 'billing-service', name: 'Billing Service' },
            _out: { id: 'ledger-service', name: 'Ledger Service' },
            cross_boundary: 'same-boundary',
            data_classification: 'highly-sensitive'
          }
        ] as unknown as RelationRecord[],
        total: 2
      }
    );

    return (
      <StoryProviders client={client}>
        <ApiIntegrationCatalogStatTiles workspaceId={WORKSPACE} />
      </StoryProviders>
    );
  }
};
