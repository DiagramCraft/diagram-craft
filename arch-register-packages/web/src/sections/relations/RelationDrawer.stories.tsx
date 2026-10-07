import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient
} from '../markdown/mdx-components/blocks/StorybookHarness';
import { entityKeys } from '../../queries/entities';
import { RelationDrawer } from './RelationDrawer';

const SCHEMA = {
  id: 'story-data-flow',
  name: 'Data Flow',
  fields: [
    { id: 'data_entities', name: 'Data', type: 'entityRelation' },
    {
      id: 'data_classification',
      name: 'Data Classification',
      type: 'select',
      options: [{ value: 'sensitive', label: 'Sensitive' }]
    },
    { id: 'protocol', name: 'Protocol', type: 'text' },
    { id: 'notes', name: 'Notes', type: 'text' }
  ]
} as unknown as RelationSchema;

const RELATION = {
  _uid: 'flow-1',
  _in: { id: 'sys-crm', name: 'CRM' },
  _out: { id: 'sys-dwh', name: 'Data Warehouse' },
  _owner: { id: 'team-1', name: 'Platform' },
  _lifecycle: { id: 'active', name: 'Active' },
  data_entities: ['ds-customers', 'ds-orders'],
  data_classification: 'sensitive',
  protocol: 'HTTPS'
} as unknown as RelationRecord;

const ENTITIES: Record<string, string> = {
  'sys-crm': 'CRM',
  'sys-dwh': 'Data Warehouse',
  'ds-customers': 'Customer Profile',
  'ds-orders': 'Order History'
};

const meta = {
  title: 'Relations/RelationDrawer',
  parameters: { layout: 'fullscreen' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDrawer = (relation: RelationRecord, schema: RelationSchema | undefined) => {
  const client = createStoryQueryClient();
  for (const [id, name] of Object.entries(ENTITIES)) {
    client.setQueryData(entityKeys.detail(WORKSPACE, id), { _uid: id, _name: name, _publicId: id });
  }
  return (
    <StoryProviders client={client}>
      <RelationDrawer
        workspaceSlug={WORKSPACE}
        relation={relation}
        relationSchema={schema}
        onClose={() => {}}
      />
    </StoryProviders>
  );
};

/** Populated fields are listed; empty ones (Notes) are skipped. */
export const DataFlow: Story = { render: () => renderDrawer(RELATION, SCHEMA) };

export const WithoutSchema: Story = { render: () => renderDrawer(RELATION, undefined) };
