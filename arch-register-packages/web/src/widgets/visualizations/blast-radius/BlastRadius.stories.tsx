import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
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
import { entityDetailQuery } from '../../../queries/entities';
import { entityBlastRadiusAggregateQuery } from '../../../queries/entityTraversal';
import { schemasQuery } from '../../../queries/schemas';
import { lifecycleStatesQuery } from '../../../queries/workspaceConfig';
import { buildBlastRadiusGroupPaths } from './blastRadiusGroups';

type BlastRadiusReached = { entityId: string; entityName: string } & Record<string, unknown>;

const API_UID = 'api-1';
const API_PUBLIC_ID = 'API-001';

const SCHEMAS = [
  {
    id: 'story-api',
    name: 'API',
    icon: 'api',
    entity_count: 1,
    fields: [
      {
        id: 'providers',
        name: 'Provided by',
        type: 'typedRelation',
        relationSchemaId: 'rs-p'
      },
      {
        id: 'consumers',
        name: 'Consumed by',
        type: 'typedRelation',
        relationSchemaId: 'rs-c'
      }
    ]
  },
  {
    id: 'service',
    name: 'Service',
    icon: 'server',
    entity_count: 3,
    fields: []
  }
] as unknown as EntitySchema[];

const LIFECYCLE_STATES = [{ id: 'active', label: 'Active', color: '#22c55e' }];

const GROUPS = [
  {
    fieldName: 'Provided by',
    label: 'Providers',
    emptyText: 'No provider relation recorded.'
  },
  { fieldName: 'Consumed by', label: 'Direct consumers' }
];

const reached = (id: string, name: string, pathId: string, depth: number): BlastRadiusReached => ({
  entityId: id,
  entityName: name,
  entitySlug: id,
  schemaId: 'service',
  schemaName: 'Service',
  ownerId: null,
  lifecycleState: 'active',
  criticality: null,
  depth,
  rank: depth,
  paths: [
    {
      rootId: API_UID,
      pathId,
      depth,
      provenance: [
        { context: 'entity', id: API_UID, schemaId: 'story-api' },
        { context: 'entity', id: id, schemaId: 'service' }
      ]
    }
  ]
});

const render = (config: Record<string, unknown>, entities: BlastRadiusReached[]) => {
  const client = createStoryQueryClient();
  client.setQueryData(schemasQuery(WORKSPACE).queryKey, SCHEMAS);
  client.setQueryData(lifecycleStatesQuery(WORKSPACE).queryKey, LIFECYCLE_STATES as never);
  client.setQueryData(entityDetailQuery(WORKSPACE, API_PUBLIC_ID).queryKey, {
    _uid: API_UID,
    _publicId: API_PUBLIC_ID,
    _name: 'Payments API',
    _schema: { id: 'story-api', name: 'API' }
  } as unknown as EntityRecord);
  for (const entity of entities) {
    client.setQueryData(entityDetailQuery(WORKSPACE, entity.entityId).queryKey, {
      _uid: entity.entityId,
      _publicId: entity.entityId.toUpperCase(),
      _name: entity.entityName
    } as unknown as EntityRecord);
  }
  client.setQueryData(
    entityBlastRadiusAggregateQuery(
      WORKSPACE,
      { kind: 'entity', entityId: API_UID },
      buildBlastRadiusGroupPaths(SCHEMAS[0], GROUPS),
      2
    ).queryKey,
    {
      entities: entities as never,
      groups: { lifecycle: [], owner: [], schema: [], criticality: [] }
    }
  );
  return (
    <StoryProviders client={client} schemas={SCHEMAS}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'blast-radius',
            'blast-radius',
            { entityId: API_PUBLIC_ID, ...config },
            0,
            0,
            12,
            20
          )
        ]}
      />
    </StoryProviders>
  );
};

const meta = {
  title: 'Widgets/Visualizations/Blast radius',
  tags: ['dashboard', 'workspace-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace dashboards only: Shows what is affected if one entity changes or fails: the entities reachable through relations, up to `maxDepth` hops away. Either every relation is walked, or specific relation fields are listed as separate columns with a second-order column for what lies behind them. The entity is usually supplied by a dashboard sidebar variable.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Configured with typed-relation groups: one column per field plus a second-order column. */
export const GroupedByRelationField: Story = {
  render: () =>
    render({ groups: GROUPS, maxDepth: 2 }, [
      reached('gateway', 'Payments Gateway', 'group-0', 1),
      reached('checkout', 'Checkout Service', 'group-1', 1),
      reached('storefront', 'Storefront', 'group-1', 2)
    ])
};

export const NoConfiguredRelationFields: Story = {
  render: () => render({ groups: [{ fieldName: 'Nonexistent', label: 'Things' }], maxDepth: 2 }, [])
};

export const WithFrame: Story = {
  ...GroupedByRelationField,
  args: { showFrame: true }
};

export const ConfigDialog = configDialogStory('blast-radius');
