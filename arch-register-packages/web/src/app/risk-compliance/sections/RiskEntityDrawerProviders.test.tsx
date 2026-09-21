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
  it('renders aggregate coverage and matching mitigating controls', () => {
    mocks.coverage = {
      rcCoverage: 35,
      rcBand: 'partial',
      controls: [
        {
          relation: { coverage: 70, effectiveness: 'partial' },
          controlId: 'control-1',
          controlName: 'MFA Enforcement'
        }
      ],
      isLoading: false,
      error: null
    };

    const definition = provider('risk.coverage');
    const markup = renderToStaticMarkup(
      <definition.Component
        context={riskContext()}
        item={item(definition.slotId)}
        label="Coverage"
      />
    );

    expect(markup).toContain('35.0%');
    expect(markup).toContain('MFA Enforcement');
    expect(markup).toContain('70% · partial');
    expect(markup).toContain('partial');
  });

  it('renders empty, loading, and unavailable states', () => {
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
        <coverage.Component context={riskContext()} item={item(coverage.slotId)} label="Coverage" />
      )
    ).toContain('No mitigating controls.');

    mocks.coverage = { ...mocks.coverage, isLoading: true };
    expect(
      renderToStaticMarkup(
        <coverage.Component context={riskContext()} item={item(coverage.slotId)} label="Coverage" />
      )
    ).toContain('Loading…');

    mocks.coverage = { ...mocks.coverage, isLoading: false, error: new Error('forbidden') };
    expect(
      renderToStaticMarkup(
        <coverage.Component context={riskContext()} item={item(coverage.slotId)} label="Coverage" />
      )
    ).toContain('Mitigating controls are unavailable.');

    const affected = provider('risk.affected-entities');
    expect(
      renderToStaticMarkup(
        <affected.Component
          context={riskContext()}
          item={item(affected.slotId)}
          label="Affected entities"
        />
      )
    ).toContain('No affected entities linked.');
  });

  it('filters affected entities by the configured relation schema and endpoint', () => {
    const definition = provider('risk.affected-entities');
    const markup = renderToStaticMarkup(
      <definition.Component
        context={riskContext({
          typedRelations: {
            outgoing: [
              {
                _uid: 'affected-1',
                _schema: { id: 'risk-affects', name: 'Risk Affects' },
                _in: { id: 'risk-1', name: 'Account Takeover' },
                _out: { id: 'system-1', name: 'Payments System' }
              },
              {
                _uid: 'other-1',
                _schema: { id: 'other', name: 'Other' },
                _in: { id: 'risk-1', name: 'Account Takeover' },
                _out: { id: 'system-2', name: 'Other System' }
              },
              {
                _uid: 'inverse-1',
                _schema: { id: 'risk-affects', name: 'Risk Affects' },
                _in: { id: 'risk-2', name: 'Other Risk' },
                _out: { id: 'system-3', name: 'Inverse System' }
              }
            ],
            incoming: []
          } as unknown as EntityDrawerProviderContext['typedRelations']
        })}
        item={item(definition.slotId)}
        label="Affected entities"
      />
    );

    expect(markup).toContain('Payments System');
    expect(markup).not.toContain('Other System');
    expect(markup).not.toContain('Inverse System');
  });

  it('reports slot support from the workspace relation fields', () => {
    expect(provider('risk.coverage').supports(riskContext())).toBe(true);
    expect(provider('risk.affected-entities').supports(riskContext())).toBe(true);
    expect(
      provider('risk.affected-entities').supports(
        riskContext({ schema: { id: 'risk', name: 'Risk', fields: [] } as never })
      )
    ).toBe(false);
  });
});
