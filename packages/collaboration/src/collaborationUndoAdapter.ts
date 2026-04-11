import type { Emitter } from '@diagram-craft/utils/event';
import type { Releasable } from '@diagram-craft/utils/releasable';
import type { CRDTRoot } from './crdt';

type StackItem = {
  meta: Map<unknown, unknown>;
};

export type CollaborationUndoAdapterEvents = {
  stackItemAdded: { stackItem: StackItem; type: 'undo' | 'redo'; tracked: boolean };
  stackItemUpdated: { stackItem: StackItem; type: 'undo' | 'redo'; tracked: boolean };
  stackItemPopped: { stackItem: StackItem; type: 'undo' | 'redo'; tracked: boolean };
  stackCleared: { undoStackCleared: boolean; redoStackCleared: boolean };
};

export interface CollaborationUndoAdapter
  extends Emitter<CollaborationUndoAdapterEvents>,
    Releasable
{
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  stopCapturing(): void;
  getUndoStackSize(): number;
  getRedoStackSize(): number;
  runTracked<T>(root: CRDTRoot, callback: () => T): T;
}
