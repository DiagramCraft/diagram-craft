import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
  frameControls,
  configDialogStory
} from '../../shared/mdx/StorybookHarness';
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
const api = (id: string, name: string) => ({ id, name, schemaId: 'story-api' });

const relation = (
  uid: string,
  from: { id: string; name: string; schemaId: string },
  to: { id: string; name: string; schemaId: string }
): RelationRecord => ({ _uid: uid, _in: from, _out: to }) as unknown as RelationRecord;

const PROVIDES = [relation('p1', system('crm', 'CRM'), api('api-orders', 'Orders API'))];
const CONSUMES = [
  relation('c1', system('checkout', 'Checkout'), api('api-orders', 'Orders API')),
  relation('c2', system('billing', 'Billing'), api('api-orders', 'Orders API'))
];
const FLOWS = [relation('f1', system('checkout', 'Checkout'), system('crm', 'CRM'))];

const CONFIG = {
  hubSchemaName: 'API',
  providerFieldName: 'Provided by',
  consumerFieldName: 'Consumed by',
  coverageRelationSchemaName: 'Data Flow'
};

const renderTile = (config: Record<string, unknown> = {}, flows: RelationRecord[] = FLOWS) => {
  const client = createStoryQueryClient();
  const seed = (schemaId: string, items: RelationRecord[]) =>
    client.setQueryData(relationKeys.list(WORKSPACE, { schemaId, limit: 500 }), {
      items,
      total: items.length
    });
  seed('rs-provides', PROVIDES);
  seed('rs-consumes', CONSUMES);
  seed('rs-flow', flows);
  return (
    <StoryProviders client={client} schemas={SCHEMAS} relationSchemas={RELATION_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'pair-gaps',
            'RelationPairGaps',
            { ...CONFIG, label: 'Provider/consumer gaps', ...config },
            0,
            0,
            3,
            8
          )
        ]}
      />
    </StoryProviders>
  );
};

const meta = {
  title: 'Widgets/Metrics/Pair coverage gaps',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: A single tile with the number of provider and consumer pairs around a shared hub entity that no chosen relation type connects. Use it to surface, for example, API consumers without a documented data flow to the API provider; pair it with the Pair coverage table to list the individual gaps.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Checkout → CRM is covered by a Data Flow; Billing → CRM is the one gap. */
export const Default: Story = {
  render: () => renderTile()
};

export const NoGaps: Story = {
  render: () =>
    renderTile({}, [...FLOWS, relation('f2', system('billing', 'Billing'), system('crm', 'CRM'))])
};

export const UnknownCoverageRelation: Story = {
  render: () => renderTile({ coverageRelationSchemaName: 'Nonexistent' })
};

export const WithFrame: Story = {
  ...Default,
  args: { frameStyle: 'header' }
};

export const ConfigDialog = configDialogStory('RelationPairGaps');
