// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { useEntityBrowserSelection, type BulkEditStep } from './useEntityBrowserSelection';

const mocks = vi.hoisted(() => ({
  getEntity: vi.fn(),
  updateEntity: vi.fn(),
  useUpdateEntity: vi.fn(),
  submitBulkProposal: vi.fn(),
  useSubmitBulkEntityChangeProposal: vi.fn()
}));

vi.mock('../../../hooks/useEntities', () => ({
  useUpdateEntity: mocks.useUpdateEntity
}));

vi.mock('../../../hooks/useEntityChanges', () => ({
  useSubmitBulkEntityChangeProposal: mocks.useSubmitBulkEntityChangeProposal
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: { entities: { get: mocks.getEntity } }
}));

const schema = {
  id: 'schema-1',
  name: 'Service',
  fields: []
} as unknown as EntitySchema;

const governedSchema = {
  id: 'schema-2',
  name: 'Governed service',
  fields: [],
  entity_approval_policy: 'required'
} as unknown as EntitySchema;

const entity = {
  _uid: 'entity-1',
  _publicId: 'SRV-1',
  _schema: { id: schema.id, name: schema.name },
  _name: 'Service',
  _slug: 'service',
  _namespace: 'default',
  _description: '',
  _owner: null,
  _lifecycle: null,
  _targetLifecycle: null,
  _targetLifecycleDate: null,
  _tags: [],
  _links: [],
  _visibilityMode: 'public',
  _projectId: null,
  _completeness: null,
  canView: true,
  canEdit: true,
  canDelete: true,
  canAdmin: true,
  canCreateChild: true
} as EntityRecord;

const makeGovernedEntity = (uid: string, name: string): EntityRecord =>
  ({
    ...entity,
    _uid: uid,
    _name: name,
    _schema: { id: governedSchema.id, name: governedSchema.name },
    _version: 1
  }) as EntityRecord;

type SelectionState = ReturnType<typeof useEntityBrowserSelection>;

const Harness = (props: { stateRef: React.MutableRefObject<SelectionState | null> }) => {
  props.stateRef.current = useEntityBrowserSelection({
    workspaceId: 'workspace-1',
    entities: [entity],
    filtered: [entity],
    filteredCount: 1,
    schemaMap: new Map([[schema.id, { schema, index: 0 }]])
  });
  return null;
};

describe('useEntityBrowserSelection delayed clearing', () => {
  let container: HTMLDivElement;
  let root: Root;
  let stateRef: React.MutableRefObject<SelectionState | null>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    mocks.getEntity.mockResolvedValue(entity);
    mocks.updateEntity.mockResolvedValue(entity);
    mocks.useUpdateEntity.mockReturnValue({ mutateAsync: mocks.updateEntity });
    mocks.submitBulkProposal.mockResolvedValue({ id: 'bulk-case-1' });
    mocks.useSubmitBulkEntityChangeProposal.mockReturnValue({
      mutateAsync: mocks.submitBulkProposal
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    stateRef = { current: null };
    act(() => root.render(<Harness stateRef={stateRef} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('clears only after the latest successful action delay', async () => {
    const state = () => stateRef.current!;

    act(() => state().handleSelectRow(entity._uid));
    await act(async () => {
      await state().handleConfirm();
    });
    expect(state().step satisfies BulkEditStep).toBe('done');
    expect(state().selectedIds).toEqual(new Set([entity._uid]));

    act(() => vi.advanceTimersByTime(1000));
    await act(async () => {
      await state().handleConfirm();
    });

    act(() => vi.advanceTimersByTime(800));
    expect(state().selectedIds).toEqual(new Set([entity._uid]));

    act(() => vi.advanceTimersByTime(1000));
    expect(state().selectedIds).toEqual(new Set());
    expect(state().step).toBe('edit');
  });
});

describe('useEntityBrowserSelection approval-gated entities', () => {
  let container: HTMLDivElement;
  let root: Root;
  let stateRef: React.MutableRefObject<SelectionState | null>;

  const entityA = makeGovernedEntity('entity-a', 'Entity A');
  const entityB = makeGovernedEntity('entity-b', 'Entity B');

  const HarnessMixed = (props: { stateRef: React.MutableRefObject<SelectionState | null> }) => {
    props.stateRef.current = useEntityBrowserSelection({
      workspaceId: 'workspace-1',
      entities: [entity, entityA, entityB],
      filtered: [entity, entityA, entityB],
      filteredCount: 3,
      schemaMap: new Map([
        [schema.id, { schema, index: 0 }],
        [governedSchema.id, { schema: governedSchema, index: 1 }]
      ])
    });
    return null;
  };

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    mocks.getEntity.mockImplementation(async ({ params }: { params: { id: string } }) =>
      [entity, entityA, entityB].find(e => e._uid === params.id)
    );
    mocks.updateEntity.mockResolvedValue(entity);
    mocks.useUpdateEntity.mockReturnValue({ mutateAsync: mocks.updateEntity });
    mocks.submitBulkProposal.mockResolvedValue({ id: 'bulk-case-1' });
    mocks.useSubmitBulkEntityChangeProposal.mockReturnValue({
      mutateAsync: mocks.submitBulkProposal
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    stateRef = { current: null };
    act(() => root.render(<HarnessMixed stateRef={stateRef} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('bundles entities requiring approval into a single bulk-submit call instead of failing direct updates', async () => {
    const state = () => stateRef.current!;

    act(() => {
      state().handleSelectRow(entityA._uid);
      state().handleSelectRow(entityB._uid);
    });
    await act(async () => {
      await state().handleConfirm();
    });

    expect(mocks.updateEntity).not.toHaveBeenCalled();
    expect(mocks.submitBulkProposal).toHaveBeenCalledTimes(1);
    const call = mocks.submitBulkProposal.mock.calls[0]![0];
    expect(call.members).toHaveLength(2);
    expect(new Set(call.members.map((m: { entityId: string }) => m.entityId))).toEqual(
      new Set([entityA._uid, entityB._uid])
    );

    expect(state().result?.proposed).toEqual({
      entities: [entityA, entityB],
      caseId: 'bulk-case-1'
    });
    expect(state().result?.skipped).toEqual([]);
  });

  it('passes the note entered for approval through as the proposal message', async () => {
    const state = () => stateRef.current!;

    act(() => {
      state().handleSelectRow(entityA._uid);
      state().handleSelectRow(entityB._uid);
    });
    await act(async () => {
      await state().handleConfirm('Renaming these together');
    });

    const call = mocks.submitBulkProposal.mock.calls[0]![0];
    expect(call.message).toBe('Renaming these together');
  });

  it('produces both applied and proposed buckets for a mixed selection', async () => {
    const state = () => stateRef.current!;

    act(() => {
      state().handleSelectRow(entity._uid);
      state().handleSelectRow(entityA._uid);
      state().handleSelectRow(entityB._uid);
    });
    await act(async () => {
      await state().handleConfirm();
    });

    expect(mocks.updateEntity).toHaveBeenCalledTimes(1);
    expect(mocks.submitBulkProposal).toHaveBeenCalledTimes(1);

    expect(state().result?.applied).toEqual([entity]);
    expect(state().result?.proposed).toEqual({
      entities: [entityA, entityB],
      caseId: 'bulk-case-1'
    });
    expect(state().result?.skipped).toEqual([]);
  });
});
