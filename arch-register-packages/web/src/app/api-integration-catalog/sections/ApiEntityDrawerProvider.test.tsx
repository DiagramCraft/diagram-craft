// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { apiEntityDrawerProviderDefinitions } from './ApiEntityDrawerProvider';

const mocks = vi.hoisted(() => ({
  artifacts: vi.fn(),
  catalog: vi.fn(),
  content: vi.fn(),
  selection: vi.fn(),
  capabilityConfigurations: vi.fn(),
  authorization: vi.fn()
}));

vi.mock('../../../auth/WorkspaceAuthorizationContext', () => ({
  useWorkspaceAuthorization: mocks.authorization
}));

vi.mock('../../../hooks/useWorkspaceConfig', () => ({
  useWorkspaceCapabilityConfigurations: mocks.capabilityConfigurations
}));

vi.mock('../../../hooks/useArtifacts', () => ({
  resolveApiSpecificationSelection: mocks.selection,
  useApiSpecificationSources: mocks.artifacts,
  useApiSpecificationCatalogQuery: mocks.catalog,
  useArtifactRevisionContent: mocks.content
}));

vi.mock('../../../sections/entities/components/ApiSpecificationCatalog', () => ({
  ApiItemRow: ({
    item,
    canViewArtifactContent
  }: {
    item: { id: string };
    canViewArtifactContent: boolean;
  }) => (
    <span>
      item:{item.id}:{canViewArtifactContent ? 'source-visible' : 'source-restricted'}
    </span>
  ),
  ApiSourceVersionPicker: () => <span>source-picker</span>,
  PAGE_SIZE: 50,
  RawSourceDialog: ({ open }: { open: boolean }) => (
    <span>raw-dialog:{open ? 'open' : 'closed'}</span>
  ),
  RevisionDiagnostics: () => <span>diagnostics</span>,
  StatusNotice: () => <span>status-notice</span>,
  useApiSpecificationCatalogQuery: mocks.catalog,
  useApiSpecificationSources: mocks.artifacts
}));

const context = {
  workspaceId: 'workspace-1',
  entity: {
    _uid: 'api-1',
    _publicId: 'API-001',
    _name: 'Orders API',
    _schema: { id: 'api', name: 'API' },
    api_type: 'openapi'
  },
  schema: {
    id: 'api',
    name: 'API',
    fields: [
      { id: 'protocols', name: 'Protocols', type: 'select' },
      { id: 'providers', name: 'Providers', type: 'typedRelation' },
      { id: 'consumers', name: 'Consumers', type: 'typedRelation' }
    ]
  },
  schemas: [],
  relationSchemas: [],
  relations: { outgoing: [], incoming: [] },
  typedRelations: { outgoing: [], incoming: [] },
  typedRelationsStatus: { isLoading: false, isError: false },
  openEntity: vi.fn()
} as unknown as EntityDrawerProviderContext;

const artifact = { id: 'artifact-1', status: 'current' } as never;
const revision = {
  revision: { id: 'revision-1' },
  isCurrent: true,
  protocol: 'openapi',
  diagnostics: []
} as never;

const renderProvider = () => {
  const definition = apiEntityDrawerProviderDefinitions[0]!;
  return renderToStaticMarkup(
    <definition.Component
      context={context}
      item={{ kind: 'slot', slotId: 'api-specification.catalog' }}
    />
  );
};

describe('API entity drawer provider', () => {
  it('renders the configured normalized catalog and respects raw-source permission', () => {
    mocks.authorization.mockReturnValue({ canViewArtifactContent: false });
    mocks.capabilityConfigurations.mockReturnValue({
      data: [
        {
          type: 'api-specification',
          bindings: { api: { target: { kind: 'entity_schema', id: 'api' } } }
        }
      ]
    });
    mocks.artifacts.mockReturnValue({
      artifactsQuery: { isLoading: false, isError: false },
      apiArtifacts: [artifact],
      sources: [{ artifact, revisions: [revision] }],
      revisionsLoading: false,
      revisionsError: false
    });
    mocks.selection.mockReturnValue({ artifact, revision });
    mocks.catalog.mockReturnValue({
      projectionQueryResult: {
        isLoading: false,
        isError: false,
        data: { revision, items: [{ id: 'operation-1' }] }
      },
      canLoadProjection: true,
      protocol: 'openapi'
    });
    mocks.content.mockReturnValue({ isLoading: false, isError: false, data: undefined });

    const markup = renderProvider();

    expect(markup).toContain('source-picker');
    expect(markup).toContain('status-notice');
    expect(markup).not.toContain('filters:openapi');
    expect(markup).toContain('item:operation-1:source-restricted');
    expect(markup).toContain('raw-dialog:closed');
    expect(mocks.catalog).toHaveBeenCalledWith(
      'workspace-1',
      'api-1',
      artifact,
      revision,
      'openapi',
      {},
      1,
      50
    );
  });

  it('preserves unavailable and not-configured artifact states', () => {
    mocks.authorization.mockReturnValue({ canViewArtifactContent: true });
    mocks.capabilityConfigurations.mockReturnValue({ data: [] });
    mocks.selection.mockReturnValue({ artifact: undefined, revision: undefined });
    mocks.catalog.mockReturnValue({
      projectionQueryResult: { isLoading: false, isError: false, data: undefined },
      canLoadProjection: false,
      protocol: undefined
    });
    mocks.content.mockReturnValue({ isLoading: false, isError: false, data: undefined });

    mocks.artifacts.mockReturnValue({
      artifactsQuery: { isLoading: false, isError: true },
      apiArtifacts: [],
      sources: [],
      revisionsLoading: false,
      revisionsError: false
    });
    expect(renderProvider()).toContain('API catalog unavailable');

    mocks.artifacts.mockReturnValue({
      artifactsQuery: { isLoading: false, isError: false },
      apiArtifacts: [],
      sources: [],
      revisionsLoading: false,
      revisionsError: false
    });
    expect(renderProvider()).toContain('No API specification configured');
  });
});
