// @vitest-environment jsdom
import { act } from 'react';
import type { MutableRefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MergePreview } from '@arch-register/api-types/entityMergeContract';
import { useMergeWizardController } from './useMergeWizardController';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  execute: vi.fn()
}));

vi.mock('../../hooks/useEntityMerge', () => ({
  useEntityMergePreview: () => ({ mutateAsync: mocks.preview, isPending: false }),
  useExecuteEntityMerge: () => ({ mutateAsync: mocks.execute, isPending: false })
}));

const basePreview: MergePreview = {
  sourceId: 'source-1',
  targetId: 'target-1',
  sourceVersion: 1,
  targetVersion: 1,
  previewFingerprint: 'fp-1',
  fieldConflicts: [
    {
      fieldKey: 'core:_description',
      fieldName: 'Description',
      kind: 'core',
      source: 'a',
      target: 'b',
      restricted: false
    }
  ],
  dependentImpact: [],
  relationConflicts: [
    {
      relationId: 'rel-1',
      relationSchemaId: 'rs-1',
      relationSchemaName: 'Depends on',
      direction: 'out',
      otherRecordId: 'other-1',
      otherRecordName: 'Other',
      duplicateRelationId: null,
      note: 'self'
    }
  ],
  sideTableConflicts: [],
  sideTableCounts: {
    entityVersions: 0,
    openChangeApprovals: 0,
    openGovernanceCases: 0,
    incomingRelations: 0,
    outgoingRelations: 0,
    externalIdentitiesTransferring: 0,
    externalIdentitiesColliding: 0
  },
  blockers: [],
  truncated: false
};

type ControllerState = ReturnType<typeof useMergeWizardController>;

const Harness = (props: {
  stateRef: MutableRefObject<ControllerState | null>;
  queuedSourceIds?: string[];
}) => {
  props.stateRef.current = useMergeWizardController({
    workspaceId: 'workspace-1',
    sourceEntityId: 'source-1',
    queuedSourceIds: props.queuedSourceIds ?? []
  });
  return null;
};

describe('useMergeWizardController', () => {
  let container: HTMLDivElement;
  let root: Root;
  let stateRef: MutableRefObject<ControllerState | null>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    stateRef = { current: null };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('moves from pick-target to review on a successful preview, defaulting resolutions', async () => {
    mocks.preview.mockResolvedValue(basePreview);
    act(() => root.render(<Harness stateRef={stateRef} />));
    const state = () => stateRef.current!;

    act(() => state().setTargetEntityId('target-1'));
    await act(async () => {
      await state().runPreview();
    });

    expect(state().phase).toBe('review');
    expect(state().preview).toEqual(basePreview);
    expect(state().resolutions.relationResolutions).toEqual({ 'rel-1': 'drop_source' });
  });

  it('reverts to pick-target with an error message when preview fails', async () => {
    mocks.preview.mockRejectedValue(new Error('boom'));
    act(() => root.render(<Harness stateRef={stateRef} />));
    const state = () => stateRef.current!;

    act(() => state().setTargetEntityId('target-1'));
    await act(async () => {
      await state().runPreview();
    });

    expect(state().phase).toBe('pick-target');
    expect(state().previewError).toBe('boom');
  });

  it('ignores attempts to resolve a self-relation conflict', async () => {
    mocks.preview.mockResolvedValue(basePreview);
    act(() => root.render(<Harness stateRef={stateRef} />));
    const state = () => stateRef.current!;

    act(() => state().setTargetEntityId('target-1'));
    await act(async () => {
      await state().runPreview();
    });
    act(() => state().setRelationResolution('rel-1', 'keep_source'));

    expect(state().resolutions.relationResolutions['rel-1']).toBe('drop_source');
  });

  it('blocks progression to confirm while a hard blocker is present', async () => {
    mocks.preview.mockResolvedValue({
      ...basePreview,
      blockers: [{ code: 'different_schema' as const, message: 'no', acknowledgeable: false }]
    });
    act(() => root.render(<Harness stateRef={stateRef} />));
    const state = () => stateRef.current!;

    act(() => state().setTargetEntityId('target-1'));
    await act(async () => {
      await state().runPreview();
    });
    expect(state().hasHardBlockers).toBe(true);

    act(() => state().goToConfirm());
    expect(state().phase).toBe('review');
  });

  it('discards prior resolutions and re-previews after a 409 on execute', async () => {
    mocks.preview.mockResolvedValue(basePreview);
    mocks.execute.mockRejectedValue(new Error('stale'));
    act(() => root.render(<Harness stateRef={stateRef} />));
    const state = () => stateRef.current!;

    act(() => state().setTargetEntityId('target-1'));
    await act(async () => {
      await state().runPreview();
    });
    act(() => state().goToConfirm());
    await act(async () => {
      await state().executeMerge();
    });
    expect(state().phase).toBe('confirm');
    expect(state().executeError).toBe('stale');

    mocks.preview.mockResolvedValue(basePreview);
    await act(async () => {
      state().refreshAfterConflict();
    });
    expect(state().phase).toBe('review');
    expect(state().executeError).toBeNull();
  });

  it('advances a queued source into a fresh review after a successful merge', async () => {
    mocks.preview.mockResolvedValue(basePreview);
    mocks.execute.mockResolvedValue({
      mergeId: 'merge-1',
      sourceId: 'source-1',
      targetId: 'target-1',
      entity: { _publicId: 'TGT-1', _name: 'Target' }
    });
    act(() =>
      root.render(<Harness stateRef={stateRef} queuedSourceIds={['source-2']} />)
    );
    const state = () => stateRef.current!;

    act(() => state().setTargetEntityId('target-1'));
    await act(async () => {
      await state().runPreview();
    });
    act(() => state().goToConfirm());
    await act(async () => {
      await state().executeMerge();
    });
    expect(state().phase).toBe('done');
    expect(state().remainingQueue).toEqual(['source-2']);

    await act(async () => {
      state().advanceQueue();
    });
    expect(state().currentSourceId).toBe('source-2');
    expect(state().remainingQueue).toEqual([]);
  });
});
