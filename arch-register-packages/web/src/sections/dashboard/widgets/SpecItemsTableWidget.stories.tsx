import type { Meta, StoryObj } from '@storybook/react-vite';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { artifactKeys } from '../../../queries/artifacts';
import { entityKeys } from '../../../queries/entities';

const SCHEMAS = [
  { id: 'story-api', name: 'API', icon: 'api', entity_count: 3, fields: [] }
] as unknown as EntitySchema[];

type Operation = { id: string; action: string; path: string; deprecated: boolean };

const APIS: { uid: string; name: string; operations: Operation[] | null }[] = [
  {
    uid: 'api-orders',
    name: 'Orders API',
    operations: [
      { id: 'o1', action: 'get', path: '/orders', deprecated: false },
      { id: 'o2', action: 'post', path: '/orders', deprecated: false },
      { id: 'o3', action: 'delete', path: '/orders/{id}', deprecated: true }
    ]
  },
  {
    uid: 'api-customers',
    name: 'Customers API',
    operations: [
      { id: 'c1', action: 'get', path: '/customers', deprecated: false },
      { id: 'c2', action: 'put', path: '/customers/{id}', deprecated: true }
    ]
  },
  { uid: 'api-legacy', name: 'Legacy API (no specification)', operations: null }
];

const DEFAULT_CONFIG = { schemaName: 'API' };

const renderDashboard = (config: Record<string, unknown> = {}, apis = APIS) => {
  const merged = { ...DEFAULT_CONFIG, ...config } as { schemaName: string; deprecated?: boolean };
  const client = createStoryQueryClient();
  client.setQueryData(
    entityKeys.list(WORKSPACE, {
      schemaId: 'story-api',
      view: 'summary',
      limit: 200,
      entityQuery: null
    }),
    {
      items: apis.map(api => ({ _uid: api.uid, _publicId: api.uid, _name: api.name })),
      total: apis.length
    }
  );
  for (const api of apis) {
    const artifactId = `${api.uid}-artifact`;
    client.setQueryData(artifactKeys.entity(WORKSPACE, api.uid), {
      artifacts:
        api.operations == null
          ? []
          : [
              {
                id: artifactId,
                artifactType: 'api-specification',
                createdAt: '2026-01-01T00:00:00.000Z',
                status: 'ready'
              }
            ]
    });
    if (api.operations == null) continue;
    client.setQueryData(artifactKeys.apiSpecificationRevisions(WORKSPACE, api.uid, artifactId), [
      { isCurrent: true, itemCount: api.operations.length, revision: { id: 'rev-1' } }
    ]);
    const items = api.operations
      .filter(operation => !merged.deprecated || operation.deprecated)
      .map(operation => ({
        ...operation,
        identifier: `${operation.action}:${operation.path}`,
        tags: []
      }));
    client.setQueryData(
      artifactKeys.apiSpecification(WORKSPACE, api.uid, artifactId, 'rev-1', {
        limit: 200,
        offset: 0,
        ...(merged.deprecated ? { deprecated: true } : {})
      }),
      { items }
    );
  }
  return (
    <StoryProviders client={client} schemas={SCHEMAS}>
      <DashboardStory
        widgets={[dashboardWidget('operations', 'SpecItemsTable', merged, 0, 0, 12, 10)]}
      />
    </StoryProviders>
  );
};

const meta = {
  title: 'Dashboard Widgets/SpecItemsTable',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllOperations: Story = { render: () => renderDashboard() };

export const DeprecatedOnly: Story = { render: () => renderDashboard({ deprecated: true }) };

export const NoSpecifications: Story = {
  render: () => renderDashboard({}, [{ uid: 'api-legacy', name: 'Legacy API', operations: null }])
};

export const UnknownSchema: Story = {
  render: () => renderDashboard({ schemaName: 'Nonexistent' })
};
