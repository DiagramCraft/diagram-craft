import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { entityKeys } from '../../../queries/entities';
import { relationKeys } from '../../../queries/relations';

const listOptions = {
  schemaId: 'risk',
  owner: undefined,
  lifecycle: undefined,
  limit: 500
};

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(entityKeys.list(WORKSPACE, listOptions), {
  items: [
    {
      _uid: 'risk-1',
      _publicId: 'RISK-001',
      _name: 'Unpatched edge gateway',
      residual_risk_score: 20
    },
    {
      _uid: 'risk-2',
      _publicId: 'RISK-002',
      _name: 'Vendor data export',
      residual_risk_score: 12
    },
    {
      _uid: 'risk-3',
      _publicId: 'RISK-003',
      _name: 'Shared admin credentials',
      residual_risk_score: 9
    },
    {
      _uid: 'risk-4',
      _publicId: 'RISK-004',
      _name: 'Legacy backup process',
      residual_risk_score: 4
    }
  ],
  total: 4
});

const meta = {
  title: 'Widgets/Data views/Ranked list',
  tags: ['dashboard', 'workspace-surface', 'project-surface'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A ranked list of the entities of a type, ordered by a numeric field or by how many relations of a chosen field point from them. Choose ascending or descending order, the number of rows, and whether each row shows a bar for its share of the listed total. Use it for "top risks" or "most consumed APIs".'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TopRisksByScore: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'top-risks',
            'TopEntities',
            {
              schema: 'risk',
              fieldId: 'residual_risk_score',
              direction: 'desc',
              limit: 3,
              label: 'Top risks by score'
            },
            0,
            0,
            4,
            4
          )
        ]}
      />
    </StoryProviders>
  )
};

const API_SCHEMAS = [
  {
    id: 'story-api',
    name: 'API',
    icon: 'api',
    entity_count: 3,
    fields: [
      {
        id: 'consumers',
        name: 'Consumed by',
        type: 'typedRelation',
        relationSchemaId: 'rs-consumes'
      }
    ]
  }
] as unknown as EntitySchema[];

const consumption = (uid: string, apiId: string) =>
  ({
    _uid: uid,
    _in: { id: `consumer-${uid}`, name: `Consumer ${uid}`, schemaId: 'system' },
    _out: { id: apiId, name: apiId, schemaId: 'story-api' }
  }) as unknown as RelationRecord;

const apiClient = createStoryQueryClient();
apiClient.setQueryData(
  entityKeys.list(WORKSPACE, {
    schemaId: 'story-api',
    owner: undefined,
    lifecycle: undefined,
    limit: 500
  }),
  {
    items: [
      { _uid: 'api-orders', _publicId: 'API-001', _name: 'Orders API' },
      { _uid: 'api-customers', _publicId: 'API-002', _name: 'Customers API' },
      { _uid: 'api-legacy', _publicId: 'API-003', _name: 'Legacy API' }
    ],
    total: 3
  }
);
const consumptions = [
  consumption('1', 'api-orders'),
  consumption('2', 'api-orders'),
  consumption('3', 'api-orders'),
  consumption('4', 'api-customers')
];
apiClient.setQueryData(relationKeys.list(WORKSPACE, { schemaId: 'rs-consumes', limit: 500 }), {
  items: consumptions,
  total: consumptions.length
});

/** Ranked by the number of relations in a typed-relation field rather than by a numeric field. */
export const MostConsumedApis: Story = {
  render: () => (
    <StoryProviders client={apiClient} schemas={API_SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'most-consumed',
            'TopEntities',
            {
              schemaName: 'API',
              relationFieldName: 'Consumed by',
              direction: 'desc',
              limit: 6,
              showLink: false,
              label: 'Most consumed APIs'
            },
            0,
            0,
            6,
            8
          )
        ]}
      />
    </StoryProviders>
  )
};
