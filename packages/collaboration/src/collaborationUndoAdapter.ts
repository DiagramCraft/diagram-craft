import type { Emitter } from '@diagram-craft/utils/event';
import type { Releasable } from '@diagram-craft/utils/releasable';
import type { CRDTRoot } from './crdt';

/**
 * Backend-native undo stack item.
 *
 * The model layer stores app-specific metadata in {@link meta} so UI and events
 * can refer back to a higher-level undo action.
 */
type StackItem = {
  meta: Map<unknown, unknown>;
};

/**
 * Events emitted by a collaboration-backed undo implementation as its native
 * undo and redo stacks change.
 */
export type CollaborationUndoAdapterEvents = {
  stackItemAdded: { stackItem: StackItem; type: 'undo' | 'redo'; tracked: boolean };
  stackItemUpdated: { stackItem: StackItem; type: 'undo' | 'redo'; tracked: boolean };
  stackItemPopped: { stackItem: StackItem; type: 'undo' | 'redo'; tracked: boolean };
  stackCleared: { undoStackCleared: boolean; redoStackCleared: boolean };
};

/**
 * Adapter interface for collaboration backends that provide native undo and redo
 * support.
 *
 * Implementations expose stack inspection events and the minimal control surface
 * needed by the model-layer {@code UndoManager} abstraction without leaking
 * backend-specific types into the model package.
 */
export interface CollaborationUndoAdapter
  extends Emitter<CollaborationUndoAdapterEvents>,
    Releasable
{
  /**
   * Returns whether an undo operation can currently be performed.
   */
  canUndo(): boolean;

  /**
   * Returns whether a redo operation can currently be performed.
   */
  canRedo(): boolean;

  /**
   * Performs one backend-native undo step.
   */
  undo(): void;

  /**
   * Performs one backend-native redo step.
   */
  redo(): void;

  /**
   * Ends the backend's current capture window so the next tracked change becomes
   * a separate history item.
   */
  stopCapturing(): void;

  /**
   * Returns the current backend undo stack depth.
   */
  getUndoStackSize(): number;

  /**
   * Returns the current backend redo stack depth.
   */
  getRedoStackSize(): number;

  /**
   * Opens a long-lived tracked session for changes that should be captured as
   * one undoable interaction.
   */
  openTrackedSession(root: CRDTRoot): Releasable;

  /**
   * Runs one short-lived tracked mutation so it is recorded by the backend's
   * native undo stack.
   */
  runTracked<T>(root: CRDTRoot, callback: () => T): T;
}
