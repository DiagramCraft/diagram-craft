import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { riskEntityDrawerProviderDefinitions } from './RiskEntityDrawerProviders';

const mocks = vi.hoisted(() => ({
  coverage: {
    rcCoverage: 35,
    rcBand: 'partial' as const,
    controls: [] as Array<{
      relation: { coverage?: number; effectiveness?: string };
      controlId: string;
      controlName: string;
    }>,
    isLoading: false,
    error: null as Error | null
  } as {
    rcCoverage: number | null;
    rcBand: 'partial' | null;
    controls: Array<{
      relation: { coverage?: number; effectiveness?: string };
      controlId: string;
      controlName: string;
    }>;
    isLoading: boolean;
    error: Error | null;
  }
}));

vi.mock('../useRiskCoverageRollup', () => ({
  useRiskCoverageRollup: () => mocks.coverage
}));

const riskContext = (
  overrides: Partial<EntityDrawerProviderContext> = {}
): EntityDrawerProviderContext =>
  ({
    workspaceId: 'workspace-1',
    entity: { _uid: 'risk-1', _name: 'Account Takeover' },
    schema: {
      id: 'risk',
      name: 'Risk',
      fields: [
        {
          id: 'mitigating_controls',
          name: 'Mitigated by',
          type: 'typedRelation',
          relationSchemaId: 'risk-control'
        },
        {
          id: 'affected_entities',
          name: 'Affects',
          type: 'typedRelation',
          relationSchemaId: 'risk-affects'
        }
      ]
    },
    schemas: [],
    relationSchemas: [],
    relations: { outgoing: [], incoming: [] },
    typedRelations: { outgoing: [], incoming: [] },
    typedRelationsStatus: { isLoading: false, isError: false },
    openEntity: vi.fn(),
    ...overrides
  }) as unknown as EntityDrawerProviderContext;

const item = (slotId: string) => ({ kind: 'slot' as const, slotId });
const provider = (slotId: string) =>
  riskEntityDrawerProviderDefinitions.find(definition => definition.slotId === slotId)!;

describe('risk entity drawer providers', () => {
  it('renders aggregate coverage stat and band', () => {
    mocks.coverage = {
      rcCoverage: 35,
      rcBand: 'partial',
      controls: [],
      isLoading: false,
      error: null
    };

    const definition = provider('risk.coverage');
    const markup = renderToStaticMarkup(
      <definition.Component context={riskContext()} item={item(definition.slotId)} />
    );

    expect(markup).toContain('35.0%');
    expect(markup).toContain('partial');
  });

  it('renders a dash when coverage is unavailable', () => {
    const coverage = provider('risk.coverage');
    mocks.coverage = {
      rcCoverage: null,
      rcBand: null,
      controls: [],
      isLoading: false,
      error: null
    };
    expect(
      renderToStaticMarkup(
        <coverage.Component context={riskContext()} item={item(coverage.slotId)} />
      )
    ).toContain('—');
  });

  it('reports slot support from the workspace relation fields', () => {
    expect(provider('risk.coverage').supports(riskContext())).toBe(true);
    expect(
      provider('risk.coverage').supports(
        riskContext({ schema: { id: 'risk', name: 'Risk', fields: [] } as never })
      )
    ).toBe(false);
  });
});
