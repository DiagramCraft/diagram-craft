// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useControlFrameworks, type ControlFrameworks } from './useControlFrameworks';

const mocks = vi.hoisted(() => ({ relationsList: vi.fn(), entityList: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: {
    relations: { list: mocks.relationsList },
    entities: { list: mocks.entityList }
  }
}));

let latest: ControlFrameworks | undefined;

const Harness = ({
  controlRequirementRelationSchemaId,
  complianceRequirementSchemaId
}: {
  controlRequirementRelationSchemaId: string | null;
  complianceRequirementSchemaId: string | null;
}) => {
  latest = useControlFrameworks(
    'ws-1',
    controlRequirementRelationSchemaId,
    complianceRequirementSchemaId
  );
  return null;
};

describe('useControlFrameworks', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.relationsList.mockReset();
    mocks.entityList.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (a: string | null, b: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness controlRequirementRelationSchemaId={a} complianceRequirementSchemaId={b} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns empty result when disabled', () => {
    render(null, null);
    expect(latest).toEqual({
      frameworkNamesByControlId: new Map(),
      frameworkOptions: [],
      isLoading: false,
      error: null
    });
    expect(mocks.relationsList).not.toHaveBeenCalled();
  });

  it('joins control-requirement relations through a requirement to its parent Framework', async () => {
    mocks.relationsList.mockResolvedValue({
      items: [
        {
          _uid: 'rel-1',
          _schema: { id: 'control-requirement-schema', name: 'Control Compliance' },
          _in: { id: 'control-1', name: 'MFA Enforcement' },
          _out: { id: 'req-1', name: 'CC6.1' },
          _owner: null,
          _lifecycle: null
        }
      ],
      total: 1
    });
    mocks.entityList.mockImplementation(({ query }: { query: { _schemaId?: string } }) => {
      if (query._schemaId === 'compliance-requirement-schema') {
        return Promise.resolve({
          items: [{ _uid: 'req-1', _name: 'CC6.1', framework: ['framework-1'] }],
          total: 1
        });
      }
      // useEntitiesByIdSetQuery's follow-up lookup, filtered by entityQuery `in` predicate.
      return Promise.resolve({
        items: [{ _uid: 'framework-1', _name: 'SOC 2', _publicId: 'FWK-001' }],
        total: 1
      });
    });

    render('control-requirement-schema', 'compliance-requirement-schema');
    await flush();

    expect(latest?.frameworkNamesByControlId.get('control-1')).toEqual(new Set(['SOC 2']));
    expect(latest?.frameworkOptions).toEqual([
      { id: 'framework-1', name: 'SOC 2', controlCount: 1 }
    ]);
  });
});
