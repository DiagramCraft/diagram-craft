import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityCapability } from '@arch-register/api-types/entityCapabilityContract';
import type { ApiSpecificationItem, Artifact } from '@arch-register/api-types/artifactContract';

const mocks = vi.hoisted(() => ({
  artifacts: vi.fn(),
  revisionLists: vi.fn(),
  projection: vi.fn(),
  content: vi.fn(),
  createSource: vi.fn(),
  refresh: vi.fn(),
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
  resolveApiSpecificationSelection: (
    sources: Array<{
      artifact: Artifact;
      revisions: Array<{ revision: { id: string }; isCurrent: boolean }>;
    }>,
    selectedArtifactId?: string,
    selectedRevisionId?: string
  ) => {
    const source = selectedArtifactId
      ? sources.find(item => item.artifact.id === selectedArtifactId)
      : sources.length === 1
        ? sources[0]
        : undefined;
    if (!source) return { artifact: undefined, revision: undefined };
    return {
      artifact: source.artifact,
      revision: selectedRevisionId
        ? source.revisions.find(item => item.revision.id === selectedRevisionId)
        : source.revisions.find(item => item.isCurrent)
    };
  },
  useEntityArtifacts: mocks.artifacts,
  useApiSpecificationRevisionLists: mocks.revisionLists,
  useApiSpecificationProjection: mocks.projection,
  useArtifactRevisionContent: mocks.content,
  useCreateApiSpecificationSource: mocks.createSource,
  useRefreshApiSpecification: mocks.refresh,
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
  sourceKey: null,
  kind: 'document',
  refreshScheduleId: null,
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

const makeEntity = (apiType: string, extra: Record<string, unknown> = {}): EntityRecord =>
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
    isCurrent: true,
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
  projection: ReturnType<typeof makeProjection> | undefined,
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
  mocks.revisionLists.mockReturnValue(
    artifact && projection
      ? [
          {
            data: [projection.revision],
            isPending: false,
            isError: false
          }
        ]
      : []
  );
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
    mocks.authorization.mockReturnValue({ canViewArtifactContent: true, canManageArtifacts: true });
    mocks.createSource.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.refresh.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.upload.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.revisionLists.mockReturnValue([]);
  });

  it('lists multiple API sources and does not choose one automatically', () => {
    const first = makeArtifact({
      id: 'artifact-a',
      currentRevisionId: 'revision-a',
      updatedAt: '2026-02-01T00:00:00.000Z'
    });
    const second = makeArtifact({
      id: 'artifact-b',
      currentRevisionId: 'revision-b',
      updatedAt: '2026-03-01T00:00:00.000Z'
    });
    const firstRevision = {
      ...makeProjection([makeItem()]).revision,
      revision: {
        ...makeProjection([makeItem()]).revision.revision,
        id: 'revision-a',
        artifactId: 'artifact-a',
        sourceRevision: 'source-a'
      }
    };
    const secondRevision = {
      ...makeProjection([makeItem({ id: 'item-b', identifier: 'listOrders' })]).revision,
      revision: {
        ...makeProjection([makeItem()]).revision.revision,
        id: 'revision-b',
        artifactId: 'artifact-b',
        sourceRevision: 'source-b'
      }
    };
    mocks.artifacts.mockReturnValue({
      data: { artifacts: [first, second], status: 'current' },
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
    mocks.revisionLists.mockReturnValue([
      { data: [firstRevision], isPending: false, isError: false },
      { data: [secondRevision], isPending: false, isError: false }
    ]);
    mocks.projection.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mocks.content.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    const markup = renderToStaticMarkup(
      <EntityApiSection
        workspaceId="workspace-1"
        entity={makeEntity('openapi')}
        outgoing={[]}
        incoming={[]}
        search={{ tab: 'api' }}
        onSearchChange={() => {}}
      />
    );

    expect(markup).toContain('Sources and versions');
    expect(markup).toContain('source-a');
    expect(markup).toContain('source-b');
    expect(markup).toContain('Select an API source');
    expect(markup).not.toContain('listPets');
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

  it('shows a manual refresh control for URL sources and keeps pending status visible', () => {
    const currentMarkup = renderApi(
      makeEntity('openapi'),
      makeArtifact({
        kind: 'url',
        location: 'https://example.com/openapi.yaml'
      }),
      makeProjection([makeItem()])
    );
    expect(currentMarkup).toContain('Refresh source');

    const pendingMarkup = renderApi(
      makeEntity('openapi'),
      makeArtifact({
        kind: 'url',
        location: 'https://example.com/openapi.yaml',
        status: 'pending',
        currentRevisionId: null,
        lastSuccessAt: null
      }),
      undefined
    );
    expect(pendingMarkup).toContain('Pending');
    expect(pendingMarkup).toContain('The API source is being processed');
  });
});
