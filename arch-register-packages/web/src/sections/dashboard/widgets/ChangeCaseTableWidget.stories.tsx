import type { Meta, StoryObj } from '@storybook/react-vite';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { governanceCasesQuery } from '../../../queries/governance';
import { entityDetailQuery } from '../../../queries/entities';

const DATA_ENTITY_SCHEMA_ID = 'story-data-entity-schema';
const schemas = [
  { id: DATA_ENTITY_SCHEMA_ID, name: 'Data Entity', icon: 'database', entity_count: 3, fields: [] }
] as unknown as EntitySchema[];
const casesQuery = { subjectType: 'entity' } as const;

const config = {
  schemaName: 'Data Entity',
  caseKinds: ['entity.change-case'],
  severity: 'due-date',
  label: 'Change cases'
};

/**
 * The generic change case table (#3504): every case of the configured kinds against entities of
 * one schema, optionally narrowed to a status.
 */
const meta = {
  title: 'Dashboard Widgets/ChangeCaseTable',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const widgets = [dashboardWidget('change-case-table', 'ChangeCaseTable', config, 0, 0, 12, 20)];

export const Populated: Story = {
  render: () => {
    const client = createStoryQueryClient();
    client.setQueryData(governanceCasesQuery(WORKSPACE, casesQuery).queryKey, [
      {
        id: 'case-1',
        caseKind: 'entity.change-case',
        subjectType: 'entity',
        subjectId: 'de-1',
        status: 'open',
        payload: {},
        createdAt: '2026-09-01T00:00:00.000Z',
        dueAt: '2026-09-10T00:00:00.000Z',
        escalatedAt: null
      },
      {
        id: 'case-2',
        caseKind: 'entity.change-case',
        subjectType: 'entity',
        subjectId: 'de-2',
        status: 'completed',
        payload: {},
        createdAt: '2026-08-01T00:00:00.000Z',
        dueAt: null,
        escalatedAt: null
      }
    ] as unknown as GovernanceCase[]);
    for (const [id, publicId, name] of [
      ['de-1', 'DE-4', 'Order Records'],
      ['de-2', 'DE-5', 'Inventory Levels']
    ] as const) {
      client.setQueryData(entityDetailQuery(WORKSPACE, id).queryKey, {
        _uid: id,
        _publicId: publicId,
        _name: name,
        _schema: { id: DATA_ENTITY_SCHEMA_ID, name: 'Data Entity' }
      } as unknown as EntityRecord);
    }

    return (
      <StoryProviders client={client} schemas={schemas}>
        <DashboardStory widgets={widgets} />
      </StoryProviders>
    );
  }
};

export const Empty: Story = {
  render: () => {
    const client = createStoryQueryClient();
    client.setQueryData(governanceCasesQuery(WORKSPACE, casesQuery).queryKey, []);

    return (
      <StoryProviders client={client} schemas={schemas}>
        <DashboardStory widgets={widgets} />
      </StoryProviders>
    );
  }
};
