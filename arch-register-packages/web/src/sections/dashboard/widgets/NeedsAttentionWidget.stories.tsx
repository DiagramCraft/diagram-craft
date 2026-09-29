import type { Meta, StoryObj } from '@storybook/react-vite';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { governanceCasesQuery } from '../../../queries/governance';
import { entityDetailQuery } from '../../../queries/entities';

const API_SCHEMA_ID = 'story-api-schema';
const casesQuery = { status: 'open', subjectType: 'entity' } as const;

/**
 * Proves the generalized "needs attention" widget (#3466) renders the same shape API & Integration
 * Catalog's and Data Stewardship's own queues did before this widget existed, now driven purely by
 * config (schema/case-kinds/scope/severity) rather than app-specific wiring.
 */
const meta = {
  title: 'Dashboard Widgets/NeedsAttention',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  render: () => {
    const client = createStoryQueryClient();
    client.setQueryData(governanceCasesQuery(WORKSPACE, casesQuery).queryKey, [
      {
        id: 'case-1',
        caseKind: 'entity.change-case',
        subjectType: 'entity',
        subjectId: 'api-1',
        status: 'open',
        payload: { kind: 'change-proposal', revisionId: 'rev-1' },
        dueAt: '2026-10-15T00:00:00.000Z'
      },
      {
        id: 'case-2',
        caseKind: 'entity.deprecation',
        subjectType: 'entity',
        subjectId: 'api-2',
        status: 'open',
        payload: { kind: 'deprecation' },
        dueAt: null
      }
    ] as unknown as GovernanceCase[]);
    client.setQueryData(entityDetailQuery(WORKSPACE, 'api-1').queryKey, {
      _uid: 'api-1',
      _publicId: 'API-001',
      _name: 'Payments API',
      _schema: { id: API_SCHEMA_ID, name: 'API' }
    } as unknown as EntityRecord);
    client.setQueryData(entityDetailQuery(WORKSPACE, 'api-2').queryKey, {
      _uid: 'api-2',
      _publicId: 'API-002',
      _name: 'Orders API',
      _schema: { id: API_SCHEMA_ID, name: 'API' }
    } as unknown as EntityRecord);

    return (
      <StoryProviders client={client}>
        <DashboardStory
          widgets={[
            dashboardWidget(
              'needs-attention',
              'NeedsAttentionQueue',
              {
                schema: API_SCHEMA_ID,
                caseKinds: ['entity.change-case', 'entity.deprecation'],
                scope: 'workspace',
                severity: 'due-date',
                limit: 8,
                label: 'Needs attention'
              },
              0,
              0,
              6,
              16
            )
          ]}
        />
      </StoryProviders>
    );
  }
};

export const Empty: Story = {
  render: () => {
    const client = createStoryQueryClient();
    client.setQueryData(governanceCasesQuery(WORKSPACE, casesQuery).queryKey, []);

    return (
      <StoryProviders client={client}>
        <DashboardStory
          widgets={[
            dashboardWidget(
              'needs-attention',
              'NeedsAttentionQueue',
              {
                schema: API_SCHEMA_ID,
                caseKinds: ['entity.change-case', 'entity.deprecation'],
                scope: 'workspace',
                severity: 'due-date',
                limit: 8,
                label: 'Needs attention'
              },
              0,
              0,
              6,
              16
            )
          ]}
        />
      </StoryProviders>
    );
  }
};
