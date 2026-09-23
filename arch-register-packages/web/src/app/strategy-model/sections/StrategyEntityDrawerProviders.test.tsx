// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { strategyEntityDrawerProviderDefinitions } from './StrategyEntityDrawerProviders';

const mocks = vi.hoisted(() => ({
  query: vi.fn()
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

vi.mock('../../../queries/workspaceConfig', () => ({
  workspaceCapabilityConfigurationsQuery: () => ({ queryKey: ['strategy-config'] })
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
      return { data: [], isLoading: false, isError: false };
    });
  });

  it('renders linked objectives', () => {
    const objectives = provider('strategy.linked-objectives');
    const item = (slotId: string) => ({ kind: 'slot' as const, slotId });

    const markup = renderToStaticMarkup(
      <objectives.Component context={context} item={item(objectives.slotId)} />
    );

    expect(markup).toContain('Increase conversion');
  });

  it('does not register linked initiatives as a specialized provider', () => {
    expect(provider('strategy.linked-initiatives')).toBeUndefined();
  });

  it('does not own the built-in containment children item', () => {
    expect(
      strategyEntityDrawerProviderDefinitions.some(
        definition => definition.slotId === 'strategy.children'
      )
    ).toBe(false);
  });
});
