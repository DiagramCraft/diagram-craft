import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
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
      <definition.Component context={context()} item={item(definition.slotId)} label="vmRisk" />
    );

    expect(markup).toContain('3.0');
    expect(markup).toContain('elevated');
  });

  it('renders contract and application empty states', () => {
    const contractDefinition = provider('vendor.contracts');
    const applicationsDefinition = provider('vendor.applications-supplied');

    expect(
      renderToStaticMarkup(
        <contractDefinition.Component
          context={context()}
          item={item(contractDefinition.slotId)}
          label="Contracts"
        />
      )
    ).toContain('No contracts.');
    expect(
      renderToStaticMarkup(
        <applicationsDefinition.Component
          context={context()}
          item={item(applicationsDefinition.slotId)}
          label="Applications supplied"
        />
      )
    ).toContain('No linked applications, via any contract.');
  });

  it('preserves the lifecycle and capabilities-funded empty states', () => {
    const lifecycleDefinition = provider('vendor.technology-lifecycle');
    const capabilitiesDefinition = provider('vendor.capabilities-funded');

    expect(
      renderToStaticMarkup(
        <lifecycleDefinition.Component
          context={context()}
          item={item(lifecycleDefinition.slotId)}
          label="Technology lifecycle"
        />
      )
    ).toContain('No linked Systems to derive a lifecycle state from.');
    expect(
      renderToStaticMarkup(
        <capabilitiesDefinition.Component
          context={context()}
          item={item(capabilitiesDefinition.slotId)}
          label="Capabilities funded"
        />
      )
    ).toContain('Not yet available — no linked capability data yet.');
  });

  it('only supports schemas with the established Vendor Management fields', () => {
    const definition = provider('vendor.risk');
    expect(definition.supports(context())).toBe(true);
    expect(
      definition.supports(
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
