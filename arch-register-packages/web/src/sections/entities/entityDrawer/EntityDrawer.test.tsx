import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { formatDate } from '../../../utils/dateFormat';
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
    status: 'Active',
    review_date: '2026-06-01'
  },
  schema: {
    id: 'service',
    name: 'Service',
    fields: [
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'status', name: 'Status', type: 'text', requirementLevel: 'expected' },
      { id: 'review_date', name: 'Review date', type: 'date' }
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
                  { kind: 'field', fieldId: 'name', label: 'Service name' },
                  { kind: 'field', fieldId: 'review_date', label: 'Review date' }
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
      <EntityDrawer
        workspaceSlug="workspace-1"
        entityId="SRV-001"
        onClose={vi.fn()}
        additionalBadges={<span>Quality badge</span>}
      />
    );

    expect(markup).toContain('Payments');
    expect(markup).toContain('SRV-001');
    expect(markup).toContain('State: Active');
    expect(markup).toContain('Current state');
    expect(markup).toContain('Service name');
    expect(markup).not.toContain('Expected');
    expect(markup).toContain('Open record in Entities');
    expect(markup).toContain('Quality badge');
  });

  it('uses the static ISO date format only when requested', () => {
    const defaultMarkup = renderToStaticMarkup(
      <EntityDrawer workspaceSlug="workspace-1" entityId="SRV-001" onClose={vi.fn()} />
    );
    const isoMarkup = renderToStaticMarkup(
      <EntityDrawer
        workspaceSlug="workspace-1"
        entityId="SRV-001"
        onClose={vi.fn()}
        dateFormat="iso"
      />
    );

    expect(defaultMarkup).toContain(formatDate('2026-06-01'));
    expect(isoMarkup).toContain('2026-06-01');
  });
});
