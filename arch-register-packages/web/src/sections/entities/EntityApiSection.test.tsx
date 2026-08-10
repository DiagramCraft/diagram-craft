import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityCapability } from '@arch-register/api-types/entityCapabilityContract';
import type { ApiSpecificationItem, Artifact } from '@arch-register/api-types/artifactContract';

const mocks = vi.hoisted(() => ({
  artifacts: vi.fn(),
  projection: vi.fn(),
  content: vi.fn(),
  upload: vi.fn(),
  authorization: vi.fn()
}));

vi.mock('../../hooks/useArtifacts', () => ({
  getArtifactStatusLabel: (status: string) =>
    ({
      not_configured: 'Not configured',
      link_only: 'Link only',
      pending: 'Pending',
      current: 'Current',
      stale: 'Stale',
      failed: 'Failed',
      invalid: 'Invalid',
      unsupported: 'Unsupported'
    })[status],
  selectApiSpecificationArtifacts: (artifacts: Artifact[]) =>
    artifacts
      .filter(artifact => artifact.artifactType === 'api-specification')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  selectApiSpecificationArtifact: (artifacts: Artifact[]) => artifacts[0],
  useEntityArtifacts: mocks.artifacts,
  useApiSpecificationProjection: mocks.projection,
  useArtifactRevisionContent: mocks.content,
  useUploadApiSpecification: mocks.upload
}));

vi.mock('../../auth/WorkspaceAuthorizationContext', () => ({
  useWorkspaceAuthorization: mocks.authorization
}));

vi.mock('../../components/EntityNavigationLink', () => ({
  EntityNavigationLink: ({
    children,
    publicId,
    ...props
  }: {
    children: React.ReactNode;
    publicId: string;
  }) => (
    <a href={`/entities/${publicId}`} {...props}>
      {children}
    </a>
  )
}));

vi.mock('@diagram-craft/app-components/Dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null
}));

const { EntityApiSection } = await import('./EntityApiSection');

const makeArtifact = (overrides: Partial<Artifact> = {}): Artifact => ({
  id: 'artifact-1',
  workspace: 'workspace-1',
  entityId: 'entity-1',
  artifactType: 'api-specification',
  kind: 'document',
  location: null,
  mediaType: 'application/json',
  status: 'current',
  currentRevisionId: 'revision-1',
  lastAttemptAt: '2026-01-01T01:00:00.000Z',
  lastSuccessAt: '2026-01-01T01:00:00.000Z',
  diagnostic: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T01:00:00.000Z',
  ...overrides
});

const makeEntity = (
  apiType: string,
  extra: Record<string, unknown> = {}
): EntityRecord =>
  ({
    canView: true,
    canEdit: true,
    canDelete: true,
    canAdmin: false,
    canCreateChild: false,
    _uid: 'entity-1',
    _publicId: 'API-1',
    _schema: { id: 'schema-api', name: 'API' },
    _name: 'Example API',
    _slug: 'example-api',
    _namespace: 'default',
    _description: 'Example API',
    _owner: null,
    _lifecycle: null,
    _targetLifecycle: null,
    _targetLifecycleDate: null,
    _tags: [],
    _links: [],
    _projectId: null,
    _completeness: 100,
    api_type: apiType,
    api_version: 'v1',
    ...extra
  }) as EntityRecord;

const makeItem = (overrides: Partial<ApiSpecificationItem> = {}): ApiSpecificationItem => ({
  id: 'item-1',
  itemKey: '#/paths/~1pets/get',
  revisionId: 'revision-1',
  protocol: 'openapi',
  itemKind: 'operation',
  path: '/pets',
  channel: null,
  action: 'get',
  identifier: 'listPets',
  declaredIdentifier: 'listPets',
  summary: 'List pets',
  description: 'Returns pets',
  tags: ['pets'],
  deprecated: false,
  parameters: [],
  input: null,
  output: { responses: { '200': { description: 'ok' } } },
  metadata: {},
  source: { pointer: '#/paths/~1pets/get', line: 8, column: 9 },
  ...overrides
});

const makeProjection = (items: ApiSpecificationItem[]) => ({
  revision: {
    revision: {
      id: 'revision-1',
      artifactId: 'artifact-1',
      sourceRevision: 'source-1',
      checksum: 'checksum-1',
      mediaType: 'application/json',
      contentSize: 100,
      createdAt: '2026-01-01T01:00:00.000Z'
    },
    protocol: items[0]?.protocol ?? 'openapi',
    specificationVersion: '3.1.0',
    title: 'Example API',
    description: null,
    status: 'current',
    itemCount: items.length,
    diagnostics: []
  },
  items,
  total: items.length,
  limit: 50,
  offset: 0
});

const renderApi = (
  entity: EntityRecord,
  artifact: Artifact | undefined,
  projection: unknown,
  entityCapability?: EntityCapability
) => {
  mocks.artifacts.mockReturnValue({
    data: { artifacts: artifact ? [artifact] : [], status: artifact?.status ?? 'not_configured' },
    isLoading: false,
    isError: false,
    refetch: vi.fn()
  });
  mocks.projection.mockReturnValue({
    data: projection,
    isLoading: false,
    isError: false,
    refetch: vi.fn()
  });
  mocks.content.mockReturnValue({ data: undefined, isLoading: false, isError: false });

  return renderToStaticMarkup(
    <EntityApiSection
      workspaceId="workspace-1"
      entity={entity}
      entityCapability={entityCapability}
      outgoing={[]}
      incoming={[]}
      search={{ tab: 'api' }}
      onSearchChange={() => {}}
    />
  );
};

describe('EntityApiSection', () => {
  beforeEach(() => {
    mocks.authorization.mockReturnValue({ canViewArtifactContent: true });
    mocks.upload.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('browses a normalized OpenAPI operation without exposing raw content by default', () => {
    const markup = renderApi(makeEntity('openapi'), makeArtifact(), makeProjection([makeItem()]));

    expect(markup).toContain('OpenAPI catalog');
    expect(markup).toContain('GET');
    expect(markup).toContain('/pets');
    expect(markup).toContain('listPets');
    expect(markup).toContain('View source');
    expect(markup).not.toContain('View raw source');
  });

  it('uses AsyncAPI channel/action labels and marks stale data as historical', () => {
    const item = makeItem({
      id: 'message-1',
      itemKey: '#/channels/orders/publish',
      protocol: 'asyncapi',
      itemKind: 'message',
      path: null,
      channel: 'orders',
      action: 'publish',
      identifier: 'OrderCreated'
    });
    const markup = renderApi(
      makeEntity('asyncapi'),
      makeArtifact({
        status: 'stale',
        diagnostic: {
          category: 'source_timeout',
          message: 'Remote source timed out',
          timestamp: '2026-01-02T00:00:00.000Z'
        }
      }),
      makeProjection([item])
    );

    expect(markup).toContain('AsyncAPI catalog');
    expect(markup).toContain('PUBLISH');
    expect(markup).toContain('orders');
    expect(markup).toContain('last successful revision');
    expect(markup).toContain('Remote source timed out');
  });

  it('distinguishes link-only and not-configured API states', () => {
    const linkMarkup = renderApi(
      makeEntity('openapi'),
      makeArtifact({
        kind: 'link',
        location: 'https://example.com/openapi.json',
        status: 'link_only',
        currentRevisionId: null
      }),
      undefined
    );
    expect(linkMarkup).toContain('Link only');
    expect(linkMarkup).toContain('no local normalized operations');
    expect(linkMarkup).toContain('Open source');

    const notConfiguredMarkup = renderApi(makeEntity('openapi'), undefined, undefined);
    expect(notConfiguredMarkup).toContain('No API specification configured');
    expect(notConfiguredMarkup).toContain('Upload API specification');
  });

  it('reads metadata and chooses the projection kind from mapped fields', () => {
    const capability: EntityCapability = {
      type: 'api-specification',
      fieldMappings: {
        api_type: 'protocol_kind',
        api_version: 'contract_version'
      }
    };
    const markup = renderApi(
      makeEntity('ignored', { protocol_kind: 'asyncapi', contract_version: 'v2' }),
      makeArtifact(),
      makeProjection([
        makeItem({
          itemKind: 'message',
          protocol: 'asyncapi',
          channel: 'orders',
          action: 'publish'
        })
      ]),
      capability
    );

    expect(markup).toContain('asyncapi');
    expect(markup).toContain('v2');
    expect(mocks.projection.mock.calls.at(-1)?.[4]).toMatchObject({ kind: 'message' });
  });
});
