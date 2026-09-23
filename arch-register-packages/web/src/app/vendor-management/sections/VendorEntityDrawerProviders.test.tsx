import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  providerSupportsContext,
  type EntityDrawerProviderContext
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { vendorEntityDrawerProviderDefinitions } from './VendorEntityDrawerProviders';

const mocks = vi.hoisted(() => ({
  configurations: [
    {
      type: 'vendor-management',
      valid: true,
      bindings: {
        vendor: { target: { kind: 'entity_schema', id: 'vendor' } },
        contract: { target: { kind: 'entity_schema', id: 'contract' } }
      }
    }
  ],
  tree: { data: { nodes: [], edges: [] }, isLoading: false, isError: false },
  spend: { vmSpend: null, currency: null, contractCount: null, isLoading: false, error: null },
  apps: { items: [], isLoading: false, error: null },
  lifecycleStates: []
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mocks.configurations, isLoading: false, isError: false })
}));

vi.mock('../../../queries/workspaceConfig', () => ({
  workspaceCapabilityConfigurationsQuery: () => ({ queryKey: ['capability-configurations'] })
}));

vi.mock('../../../hooks/useEntities', () => ({
  useEntityTree: () => mocks.tree
}));

vi.mock('../../../hooks/useWorkspaceConfig', () => ({
  useLifecycleStates: () => ({ data: mocks.lifecycleStates })
}));

vi.mock('../useVendorSpendRollup', () => ({
  useVendorSpendRollup: () => mocks.spend
}));

vi.mock('../useVendorAppsSupplied', () => ({
  useVendorAppsSupplied: () => mocks.apps
}));

const context = (overrides: Partial<EntityDrawerProviderContext> = {}) =>
  ({
    workspaceId: 'workspace-1',
    entity: {
      _uid: 'vendor-1',
      _publicId: 'VND-001',
      _name: 'Acme Corp',
      _schema: { id: 'vendor', name: 'Vendor' },
      security_risk: 3,
      concentration_risk: 3,
      financial_risk: 3,
      compliance_risk: 3,
      criticality: 3
    },
    schema: {
      id: 'vendor',
      name: 'Vendor',
      fields: [
        'category',
        'tier',
        'status',
        'relationship_owner',
        'cost_centre',
        'security_risk',
        'concentration_risk',
        'financial_risk',
        'compliance_risk',
        'criticality'
      ].map(id => ({ id, name: id, type: 'text' }))
    },
    schemas: [
      {
        id: 'contract',
        name: 'Contract',
        fields: [
          {
            id: 'system',
            name: 'Used by',
            type: 'typedRelation',
            relationSchemaId: 'system-contract'
          },
          { id: 'annual_cost', name: 'Annual Cost', type: 'currency' }
        ]
      }
    ],
    relationSchemas: [],
    relations: { outgoing: [], incoming: [] },
    typedRelations: { outgoing: [], incoming: [] },
    typedRelationsStatus: { isLoading: false, isError: false },
    openEntity: vi.fn(),
    ...overrides
  }) as unknown as EntityDrawerProviderContext;

const item = (slotId: string) => ({ kind: 'slot' as const, slotId });

const provider = (slotId: string) =>
  vendorEntityDrawerProviderDefinitions.find(definition => definition.slotId === slotId)!;

describe('Vendor Management entity drawer providers', () => {
  it('renders the derived risk score and band', () => {
    const definition = provider('vendor.risk');
    const markup = renderToStaticMarkup(
      <definition.Component context={context()} item={item(definition.slotId)} />
    );

    expect(markup).toContain('3.0');
    expect(markup).toContain('elevated');
  });

  it('renders contract and application empty states', () => {
    const contractDefinition = provider('vendor.contracts');
    const applicationsDefinition = provider('vendor.applications-supplied');

    expect(
      renderToStaticMarkup(
        <contractDefinition.Component context={context()} item={item(contractDefinition.slotId)} />
      )
    ).toContain('No contracts.');
    expect(
      renderToStaticMarkup(
        <applicationsDefinition.Component
          context={context()}
          item={item(applicationsDefinition.slotId)}
        />
      )
    ).toContain('No linked applications, via any contract.');
  });

  it('preserves the lifecycle empty state', () => {
    const lifecycleDefinition = provider('vendor.technology-lifecycle');

    expect(
      renderToStaticMarkup(
        <lifecycleDefinition.Component
          context={context()}
          item={item(lifecycleDefinition.slotId)}
        />
      )
    ).toContain('No linked Systems to derive a lifecycle state from.');
  });

  it('does not register the static capabilities-funded placeholder as a provider', () => {
    expect(vendorEntityDrawerProviderDefinitions).not.toContainEqual(
      expect.objectContaining({ slotId: 'vendor.capabilities-funded' })
    );
  });

  it('only supports schemas with the established Vendor Management fields', () => {
    const definition = provider('vendor.risk');
    expect(providerSupportsContext(definition, context())).toBe(true);
    expect(
      providerSupportsContext(
        definition,
        context({
          schema: {
            id: 'other',
            name: 'Other',
            fields: []
          } as unknown as EntityDrawerProviderContext['schema']
        })
      )
    ).toBe(false);
  });
});
