// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { strategyEntityDrawerProviderDefinitions } from './StrategyEntityDrawerProviders';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  realizedBy: {
    items: [
      {
        entity: { _uid: 'app-1', _name: 'Billing System' },
        contributingCapability: { _uid: 'child-1', _name: 'Account Management' }
      }
    ],
    isLoading: false,
    error: null
  }
}));

const config = {
  type: 'strategy-model',
  valid: true,
  bindings: {
    objective: { target: { kind: 'entity_schema', id: 'objective' } },
    outcome: { target: { kind: 'entity_schema', id: 'outcome' } },
    initiative: { target: { kind: 'entity_schema', id: 'initiative' } },
    measure: { target: { kind: 'entity_schema', id: 'measure' } },
    business_capability: { target: { kind: 'entity_schema', id: 'business_capability' } },
    objective_supports_business_capability: {
      target: { kind: 'relation_schema', id: 'osc-rel' }
    },
    business_capability_supports_entity: {
      target: { kind: 'relation_schema', id: 'bcse-rel' }
    }
  }
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => mocks.query(options)
}));

vi.mock('../../../queries/entities', () => ({
  entitiesQuery: () => ({ queryKey: ['entities'] })
}));

vi.mock('../../../queries/workspaceConfig', () => ({
  workspaceCapabilityConfigurationsQuery: () => ({ queryKey: ['strategy-config'] })
}));

vi.mock('../useCapabilityRealizedBy', () => ({
  useCapabilityRealizedBy: () => mocks.realizedBy
}));

const context = {
  workspaceId: 'workspace-1',
  entity: { _uid: 'cap-1', _name: 'Customer Management', _schema: { id: 'business_capability' } },
  schema: {
    id: 'business_capability',
    name: 'Business Capability',
    fields: [
      { id: 'parent', name: 'Parent', type: 'containment' },
      { id: 'capability_level', name: 'Capability Level', type: 'derived' },
      { id: 'maturity', name: 'Maturity', type: 'number' },
      { id: 'maturity_target', name: 'Maturity Target', type: 'number' },
      { id: 'gap', name: 'Maturity Gap', type: 'derived' },
      { id: 'annual_investment', name: 'Annual Investment', type: 'currency' },
      { id: 'risk', name: 'Risk', type: 'number' }
    ]
  },
  schemas: [],
  relationSchemas: [],
  relations: { outgoing: [], incoming: [] },
  typedRelations: {
    outgoing: [],
    incoming: [
      {
        _uid: 'objective-link',
        _schema: { id: 'osc-rel', name: 'Supports' },
        _in: { id: 'objective-1', name: 'Increase conversion' },
        _out: { id: 'cap-1', name: 'Customer Management' }
      }
    ]
  },
  typedRelationsStatus: { isLoading: false, isError: false },
  openEntity: vi.fn()
} as unknown as EntityDrawerProviderContext;

const provider = (slotId: string) =>
  strategyEntityDrawerProviderDefinitions.find(definition => definition.slotId === slotId)!;

describe('strategy entity drawer providers', () => {
  beforeEach(() => {
    mocks.query.mockImplementation((options: { queryKey: readonly unknown[] }) => {
      if (options.queryKey[0] === 'strategy-config') {
        return { data: [config], isLoading: false, isError: false };
      }
      return {
        data: { items: [{ _uid: 'initiative-1', _name: 'Checkout Simplification' }] },
        isLoading: false,
        isError: false
      };
    });
  });

  it('renders realized-by provenance, objectives, and initiatives', () => {
    const realizedBy = provider('strategy.realized-by');
    const objectives = provider('strategy.linked-objectives');
    const initiatives = provider('strategy.linked-initiatives');
    const item = (slotId: string) => ({ kind: 'slot' as const, slotId });

    const markup = [
      renderToStaticMarkup(
        <realizedBy.Component context={context} item={item(realizedBy.slotId)} />
      ),
      renderToStaticMarkup(
        <objectives.Component context={context} item={item(objectives.slotId)} />
      ),
      renderToStaticMarkup(
        <initiatives.Component context={context} item={item(initiatives.slotId)} />
      )
    ].join('');

    expect(markup).toContain('Billing System');
    expect(markup).toContain('via Account Management');
    expect(markup).toContain('Increase conversion');
    expect(markup).toContain('Checkout Simplification');
  });

  it('does not own the built-in containment children item', () => {
    expect(
      strategyEntityDrawerProviderDefinitions.some(
        definition => definition.slotId === 'strategy.children'
      )
    ).toBe(false);
  });

  it('does not own the roll-up slot — it is a generic drawer item kind now', () => {
    expect(
      strategyEntityDrawerProviderDefinitions.some(
        definition => definition.slotId === 'strategy.rollup'
      )
    ).toBe(false);
  });
});
