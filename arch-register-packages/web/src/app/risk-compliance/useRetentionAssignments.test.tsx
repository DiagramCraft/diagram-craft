// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useRetentionAssignments,
  type RetentionAssignmentRow,
  type RetentionPolicyRow
} from './useRetentionAssignments';
import type { RetentionFieldIds } from './riskComplianceQueries';

const mocks = vi.hoisted(() => ({ entitiesList: vi.fn(), relationsList: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entitiesList },
    relations: { list: mocks.relationsList }
  }
}));

const fieldIds: RetentionFieldIds = {
  durationFieldId: 'duration',
  timeUnitFieldId: 'time_unit',
  activatedFromFieldId: 'activated_from'
};

const policy = (id: string, overrides: Record<string, unknown> = {}) => ({
  _uid: id,
  _publicId: id,
  _name: `Policy ${id}`,
  duration: 1,
  time_unit: 'years',
  ...overrides
});

const assignment = (id: string, policyId: string, overrides: Record<string, unknown> = {}) => ({
  _uid: id,
  _schema: { id: 'assignment-schema', name: 'Subject to Retention Policy' },
  _in: { id: `entity-${id}`, name: `Entity ${id}`, schemaId: 'data-entity-schema' },
  _out: { id: policyId, name: `Policy ${policyId}`, schemaId: 'policy-schema' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  canView: true,
  canEdit: true,
  activated_from: '2026-01-01',
  ...overrides
});

let latest:
  | { rows: RetentionAssignmentRow[]; policyRows: RetentionPolicyRow[]; isLoading: boolean }
  | undefined;

const Harness = () => {
  latest = useRetentionAssignments(
    'ws-1',
    { policySchemaId: 'policy-schema', assignmentSchemaId: 'assignment-schema' },
    fieldIds
  );
  return null;
};

describe('useRetentionAssignments', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.entitiesList.mockReset();
    mocks.relationsList.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('joins assignments to their governing policy and reports its period as a plain fact', async () => {
    mocks.entitiesList.mockResolvedValue({ items: [policy('policy-1')], total: 1 });
    mocks.relationsList.mockResolvedValue({
      items: [assignment('assignment-1', 'policy-1')],
      total: 1
    });
    render();
    await flush();

    expect(latest?.rows).toHaveLength(1);
    const row = latest!.rows[0]!;
    expect(row.governedEntityName).toBe('Entity assignment-1');
    expect(row.policyName).toBe('Policy policy-1');
    expect(row.policyPeriod).toBe('1 years');
    expect(row.activatedFrom).toBe('2026-01-01');
    expect(row.policyId).toBe('policy-1');
    expect(row.missing).toEqual([]);

    expect(latest!.policyRows).toHaveLength(1);
    expect(latest!.policyRows[0]!.governedCount).toBe(1);
  });

  it('reports what is missing when the governing policy has no duration data', async () => {
    mocks.entitiesList.mockResolvedValue({
      items: [policy('policy-1', { duration: undefined })],
      total: 1
    });
    mocks.relationsList.mockResolvedValue({
      items: [assignment('assignment-1', 'policy-1')],
      total: 1
    });
    render();
    await flush();

    expect(latest!.rows[0]!.missing).toEqual(['duration']);
    expect(latest!.rows[0]!.policyPeriod).toBeNull();
  });

  it('reports every missing field when the policy is unresolvable and the date is blank', async () => {
    mocks.entitiesList.mockResolvedValue({ items: [], total: 0 });
    mocks.relationsList.mockResolvedValue({
      items: [assignment('assignment-1', 'policy-1', { activated_from: undefined })],
      total: 1
    });
    render();
    await flush();

    expect(latest!.rows[0]!.missing).toEqual([
      'policy',
      'duration',
      'time unit',
      'activation date'
    ]);
  });

  it('counts zero governed assignments for a policy nothing points at', async () => {
    mocks.entitiesList.mockResolvedValue({ items: [policy('policy-1')], total: 1 });
    mocks.relationsList.mockResolvedValue({ items: [], total: 0 });
    render();
    await flush();

    expect(latest!.policyRows[0]!.governedCount).toBe(0);
  });
});
