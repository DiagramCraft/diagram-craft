import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EntityDrawer } from './EntityDrawer';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entity: {
    _uid: 'entity-1',
    _publicId: 'SRV-001',
    _schema: { id: 'service', name: 'Service' },
    _name: 'Payments',
    _slug: 'payments',
    _description: '',
    _owner: null,
    _lifecycle: null,
    _targetLifecycle: null,
    _targetLifecycleDate: null,
    _namespace: '',
    _tags: [],
    _links: [],
    name: 'Payments',
    status: 'Active'
  },
  schema: {
    id: 'service',
    name: 'Service',
    fields: [
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'status', name: 'Status', type: 'text' }
    ],
    groups: [],
    shared_field_group_links: []
  }
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaceSlug: 'workspace-1',
    schemas: [mocks.schema],
    relationSchemas: [],
    lifecycleStates: [],
    currencies: { currencies: [], default_currency: 'USD' }
  })
}));

vi.mock('../../../auth/WorkspaceAuthorizationContext', () => ({
  useWorkspaceAuthorization: () => ({ getFieldGroupAccess: () => 'edit' })
}));

vi.mock('../../../hooks/usePrincipalLabel', () => ({
  usePrincipalLabel: () => () => undefined
}));

vi.mock('../../../hooks/useEntities', () => ({
  useEntity: () => ({ data: mocks.entity, isLoading: false, isError: false }),
  useEntitiesBySchema: () => [],
  useEntityRelations: () => ({ data: { outgoing: [], incoming: [] } })
}));

vi.mock('../../../hooks/useRelations', () => ({
  useEntityTypedRelations: () => ({ data: { outgoing: [], incoming: [] } })
}));

vi.mock('../../../hooks/useWorkspaceConfig', () => ({
  useEntityDrawerConfiguration: () => ({
    data: {
      effective_configuration: {
        version: 1,
        profiles: {
          service: {
            header: { badges: [{ kind: 'field', fieldId: 'status', label: 'State' }] },
            sections: [
              {
                id: 'custom',
                title: 'Configured details',
                collapsible: false,
                items: [
                  { kind: 'field', fieldId: 'status', label: 'Current state' },
                  { kind: 'field', fieldId: 'name', label: 'Service name' }
                ]
              }
            ]
          }
        }
      },
      diagnostics: []
    }
  })
}));

describe('EntityDrawer', () => {
  it('renders configured content with fixed identity and full-record navigation', () => {
    const markup = renderToStaticMarkup(
      <EntityDrawer workspaceSlug="workspace-1" entityId="SRV-001" onClose={vi.fn()} />
    );

    expect(markup).toContain('Payments');
    expect(markup).toContain('SRV-001');
    expect(markup).toContain('State: Active');
    expect(markup).toContain('Current state');
    expect(markup).toContain('Service name');
    expect(markup.indexOf('Current state')).toBeLessThan(markup.indexOf('Service name'));
    expect(markup).toContain('Open record in Entities');
  });
});
