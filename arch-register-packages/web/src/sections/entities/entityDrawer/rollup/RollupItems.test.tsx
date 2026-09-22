// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../EntityDrawerProviderRegistry';
import { RollupStatItem, RollupLeafCountItem } from './RollupItems';

const mocks = vi.hoisted(() => ({
  metric: {
    value: null as number | null,
    currency: null as string | null,
    isLoading: false,
    error: null as Error | null
  },
  leafCount: { leafCount: null as number | null, isLoading: false, error: null as Error | null }
}));

vi.mock('./useEntityRollupMetric', () => ({
  useEntityRollupMetric: () => mocks.metric
}));

vi.mock('./useEntityRollupLeafCount', () => ({
  useEntityRollupLeafCount: () => mocks.leafCount
}));

const context = {
  workspaceId: 'workspace-1',
  schema: {
    id: 'business_capability',
    fields: [
      { id: 'parent', name: 'Parent', type: 'containment' },
      { id: 'maturity', name: 'Maturity', type: 'number' },
      { id: 'annual_investment', name: 'Annual Investment', type: 'currency' }
    ]
  }
} as unknown as EntityDrawerProviderContext;

const entity = { _uid: 'cap-1', _name: 'Customer Management' } as unknown as Parameters<
  typeof RollupStatItem
>[0]['entity'];

describe('RollupStatItem / RollupLeafCountItem', () => {
  it('renders a currency-formatted roll-up value', () => {
    mocks.metric.value = 150000;
    mocks.metric.currency = 'USD';
    mocks.metric.isLoading = false;
    mocks.metric.error = null;

    const markup = renderToStaticMarkup(
      <RollupStatItem
        item={{
          kind: 'rollup',
          fieldId: 'annual_investment',
          aggregation: 'sum',
          format: 'currency'
        }}
        label="Annual investment"
        entity={entity}
        context={context}
      />
    );

    expect(markup).toContain('Annual investment');
    expect(markup).toMatch(/\$150K/i);
  });

  it('shows a loading state while the metric query is in flight', () => {
    mocks.metric.value = null;
    mocks.metric.isLoading = true;
    mocks.metric.error = null;

    const markup = renderToStaticMarkup(
      <RollupStatItem
        item={{ kind: 'rollup', fieldId: 'maturity', aggregation: 'avg', format: 'decimal1' }}
        label="Maturity"
        entity={entity}
        context={context}
      />
    );

    expect(markup).toContain('Loading');
  });

  it('shows an unavailable state on error', () => {
    mocks.metric.isLoading = false;
    mocks.metric.error = new Error('boom');

    const markup = renderToStaticMarkup(
      <RollupStatItem
        item={{ kind: 'rollup', fieldId: 'maturity', aggregation: 'avg', format: 'decimal1' }}
        label="Maturity"
        entity={entity}
        context={context}
      />
    );

    expect(markup).toContain('unavailable');
  });

  it('renders the leaf count', () => {
    mocks.leafCount.leafCount = 4;
    mocks.leafCount.isLoading = false;
    mocks.leafCount.error = null;

    const markup = renderToStaticMarkup(
      <RollupLeafCountItem
        item={{ kind: 'rollup-leaf-count' }}
        label="Leaf count"
        entity={entity}
        context={context}
      />
    );

    expect(markup).toContain('Leaf count');
    expect(markup).toContain('4');
  });
});
