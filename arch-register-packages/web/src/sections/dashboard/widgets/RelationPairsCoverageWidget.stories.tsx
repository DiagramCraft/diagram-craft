import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { relationKeys } from '../../../queries/relations';

const SCHEMAS = [
  {
    id: 'story-api',
    name: 'API',
    icon: 'api',
    entity_count: 2,
    fields: [
      {
        id: 'providers',
        name: 'Provided by',
        type: 'typedRelation',
        relationSchemaId: 'rs-provides'
      },
      {
        id: 'consumers',
        name: 'Consumed by',
        type: 'typedRelation',
        relationSchemaId: 'rs-consumes'
      }
    ]
  }
] as unknown as EntitySchema[];

const RELATION_SCHEMAS = [
  { id: 'rs-provides', name: 'Provides API', fields: [] },
  { id: 'rs-consumes', name: 'Consumes API', fields: [] },
  { id: 'rs-flow', name: 'Data Flow', fields: [] }
] as unknown as RelationSchema[];

const system = (id: string, name: string) => ({ id, name, schemaId: 'system' });
const component = (id: string, name: string) => ({ id, name, schemaId: 'component' });
const api = (id: string, name: string) => ({ id, name, schemaId: 'story-api' });

const relation = (
  uid: string,
  from: { id: string; name: string; schemaId: string },
  to: { id: string; name: string; schemaId: string }
): RelationRecord => ({ _uid: uid, _in: from, _out: to }) as unknown as RelationRecord;

const PROVIDES = [
  relation('p1', system('crm', 'CRM'), api('api-orders', 'Orders API')),
  relation('p2', component('orders-svc', 'Orders service'), api('api-customers', 'Customers API'))
];
const CONSUMES = [
  relation('c1', system('checkout', 'Checkout'), api('api-orders', 'Orders API')),
  relation('c2', system('billing', 'Billing'), api('api-orders', 'Orders API')),
  relation('c3', system('checkout', 'Checkout'), api('api-customers', 'Customers API'))
];
const FLOWS = [relation('f1', system('checkout', 'Checkout'), system('crm', 'CRM'))];

const DEFAULT_CONFIG = {
  hubSchemaName: 'API',
  providerFieldName: 'Provided by',
  consumerFieldName: 'Consumed by',
  coverageRelationSchemaName: 'Data Flow'
};

const renderDashboard = (
  config: Record<string, unknown> = {},
  data: {
    providers?: RelationRecord[];
    consumers?: RelationRecord[];
    flows?: RelationRecord[];
  } = {}
) => {
  const client = createStoryQueryClient();
  const seed = (schemaId: string, items: RelationRecord[]) =>
    client.setQueryData(relationKeys.list(WORKSPACE, { schemaId, limit: 500 }), {
      items,
      total: items.length
    });
  seed('rs-provides', data.providers ?? PROVIDES);
  seed('rs-consumes', data.consumers ?? CONSUMES);
  seed('rs-flow', data.flows ?? FLOWS);
  return (
    <StoryProviders client={client} schemas={SCHEMAS} relationSchemas={RELATION_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'pairs',
            'RelationPairsCoverage',
            { ...DEFAULT_CONFIG, ...config },
            0,
            0,
            12,
            10
          )
        ]}
      />
    </StoryProviders>
  );
};

const meta = {
  title: 'Dashboard Widgets/RelationPairsCoverage',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Checkout → CRM is covered by a Data Flow; Billing → CRM is a gap; the Component provider is n/a. */
export const LinkedGapAndNotApplicable: Story = { render: () => renderDashboard() };

export const CustomHeadings: Story = {
  render: () =>
    renderDashboard({
      label: 'API usage',
      hubLabel: 'Interface',
      providerLabel: 'Exposed by',
      consumerLabel: 'Used by',
      coverageLabel: 'Documented flow'
    })
};

export const NoPairs: Story = {
  render: () => renderDashboard({}, { providers: [], consumers: [], flows: [] })
};

export const MissingRelationFields: Story = {
  render: () => renderDashboard({ providerFieldName: 'Nonexistent' })
};

export const UnknownCoverageRelation: Story = {
  render: () => renderDashboard({ coverageRelationSchemaName: 'Nonexistent' })
};
