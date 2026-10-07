import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { entityKeys } from '../../../queries/entities';
import { relationKeys } from '../../../queries/relations';
import { buildRelationQueryText } from './relationTableLogic';

const CLASSIFICATION_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'sensitive', label: 'Sensitive' },
  { value: 'highly-sensitive', label: 'Highly sensitive' }
];

const SCHEMA_NAME = 'Data Flow';

const RELATION_SCHEMAS = [
  {
    id: 'story-data-flow',
    name: SCHEMA_NAME,
    fields: [
      {
        id: 'data_entities',
        name: 'Data Entities',
        type: 'entityRelation'
      },
      {
        id: 'data_classification',
        name: 'Data Classification',
        type: 'select',
        options: CLASSIFICATION_OPTIONS
      },
      { id: 'protocol', name: 'Protocol', type: 'text' },
      {
        id: 'cross_boundary',
        name: 'Cross-Boundary Transfer',
        type: 'derived',
        resultType: 'select',
        options: [
          { value: 'same-region', label: 'Same region' },
          { value: 'cross-boundary', label: 'Cross-boundary' },
          { value: 'incomplete', label: 'Incomplete' }
        ]
      }
    ]
  }
] as unknown as RelationSchema[];

const DATASETS: Record<string, string> = {
  'ds-customers': 'Customer Profile',
  'ds-payments': 'Payment Transactions',
  'ds-orders': 'Order History'
};

const flow = (
  id: string,
  from: string,
  to: string,
  fields: Record<string, unknown>
): RelationRecord =>
  ({
    _uid: id,
    _in: { id: `${id}-in`, name: from },
    _out: { id: `${id}-out`, name: to },
    _schema: { id: 'story-data-flow', name: SCHEMA_NAME },
    _owner: { id: 'team-1', name: 'Platform' },
    _updatedAt: '2026-01-15T10:00:00.000Z',
    ...fields
  }) as unknown as RelationRecord;

const FLOWS = [
  flow('f1', 'CRM', 'Data Warehouse', {
    data_entities: ['ds-customers'],
    data_classification: 'highly-sensitive',
    protocol: 'HTTPS',
    cross_boundary: 'cross-boundary'
  }),
  flow('f2', 'Checkout', 'Payment Gateway', {
    data_entities: ['ds-payments', 'ds-orders'],
    data_classification: 'sensitive',
    protocol: 'gRPC',
    cross_boundary: 'same-region'
  }),
  flow('f3', 'Billing', 'Ledger', {
    data_entities: ['ds-payments'],
    data_classification: 'sensitive',
    protocol: 'Kafka',
    cross_boundary: 'incomplete'
  })
];

const meta = {
  title: 'Dashboard Widgets/RelationTable',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const DEFAULT_CONFIG = {
  relationSchemaName: SCHEMA_NAME,
  filter: 'data_classification in ("sensitive", "highly-sensitive")',
  fieldIds: ['data_entities', 'data_classification', 'protocol', 'cross_boundary'],
  sort: 'data_classification',
  limit: 100,
  label: 'Flows carrying restricted data'
};

const renderDashboard = (
  relations: RelationRecord[],
  config: Record<string, unknown> = {},
  { parseOk = true }: { parseOk?: boolean } = {}
) => {
  const merged = { ...DEFAULT_CONFIG, ...config } as typeof DEFAULT_CONFIG;
  const client = createStoryQueryClient();
  const queryText = buildRelationQueryText(merged.relationSchemaName, merged.filter);
  const relationQuery = { root_kind: 'relation', story: queryText };
  client.setQueryData(
    ['relation-table', 'parse', WORKSPACE, queryText],
    parseOk ? { ok: true, query: relationQuery } : { ok: false }
  );
  client.setQueryData(
    relationKeys.list(WORKSPACE, { relationQuery, view: 'full', limit: merged.limit }),
    { items: relations, total: relations.length }
  );
  for (const [id, name] of Object.entries(DATASETS)) {
    client.setQueryData(entityKeys.detail(WORKSPACE, id), { _uid: id, _name: name, _publicId: id });
  }
  return (
    <StoryProviders client={client} relationSchemas={RELATION_SCHEMAS}>
      <DashboardStory
        widgets={[dashboardWidget('relations', 'RelationTable', merged, 0, 0, 12, 10)]}
      />
    </StoryProviders>
  );
};

export const RestrictedFlows: Story = { render: () => renderDashboard(FLOWS) };

export const OwnerAndUpdatedColumns: Story = {
  render: () =>
    renderDashboard(FLOWS, {
      fieldIds: ['protocol', '_owner', '_updatedAt'],
      sort: 'protocol',
      label: 'Flows by protocol'
    })
};

export const NoMatches: Story = { render: () => renderDashboard([]) };

export const InvalidFilter: Story = {
  render: () => renderDashboard([], { filter: 'data_classification in (' }, { parseOk: false })
};

export const UnknownRelationType: Story = {
  render: () => renderDashboard(FLOWS, { relationSchemaName: 'Nonexistent' })
};

export const WithRowDrawer: Story = {
  render: () => renderDashboard(FLOWS, { rowDrawer: true, label: 'Click a row for details' })
};
