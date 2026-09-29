import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient
} from '../../../sections/markdown/mdx-components/blocks/StorybookHarness';
import { relationsQuery } from '../../../queries/relations';
import { ApiIntegrationCatalogAtRiskPanel } from './ApiIntegrationCatalogAtRiskPanel';
import {
  DATA_FLOW_RELATION_SCHEMA_ID,
  seedDataFlowRelationSchema
} from './apiIntegrationCatalogStoryFixtures';

/**
 * Proves `ApiIntegrationCatalogAtRiskPanel` (#3458) renders from a plain prop object with zero
 * router involvement — see #3459. The panel takes only `workspaceId` and an `onViewIntegrations`
 * callback; navigation itself stays in the Screen (`ApiIntegrationCatalogDashboardScreens.tsx`).
 */
const meta = {
  title: 'API & Integration Catalog/AtRiskPanel',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AtRisk: Story = {
  render: () => {
    const client = createStoryQueryClient();
    seedDataFlowRelationSchema(client, true);
    client.setQueryData(
      relationsQuery(WORKSPACE, { schemaId: DATA_FLOW_RELATION_SCHEMA_ID, limit: 500 }).queryKey,
      {
        items: [
          {
            _uid: 'relation-1',
            _in: { id: 'checkout-service', name: 'Checkout Service' },
            _out: { id: 'payments-service', name: 'Payments Service' },
            cross_boundary: 'cross-boundary',
            data_classification: 'internal'
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
        <ApiIntegrationCatalogAtRiskPanel workspaceId={WORKSPACE} onViewIntegrations={() => {}} />
      </StoryProviders>
    );
  }
};

export const DataFlowNotConfigured: Story = {
  render: () => {
    const client = createStoryQueryClient();
    seedDataFlowRelationSchema(client, false);

    return (
      <StoryProviders client={client}>
        <ApiIntegrationCatalogAtRiskPanel workspaceId={WORKSPACE} onViewIntegrations={() => {}} />
      </StoryProviders>
    );
  }
};
