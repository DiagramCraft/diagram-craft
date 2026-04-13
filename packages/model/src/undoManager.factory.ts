import type { Diagram } from './diagram';
import type { UndoManager } from './undoManager';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { DefaultUndoManager } from './undoManager.default';
import { CollaborationBackendUndoManager } from './undoManager.collaboration';

/**
 * Creates the undo manager for a diagram based on the active collaboration
 * backend.
 *
 * Collaboration-capable backends may provide a native undo adapter. When they
 * do, the diagram uses {@link CollaborationBackendUndoManager}; otherwise it
 * falls back to the local in-memory {@link DefaultUndoManager}.
 */
export const createUndoManager = (diagram: Diagram): UndoManager => {
  const collaborationUndoAdapter = CollaborationConfig.Backend.createUndoAdapter?.(
    diagram.document.root
  );
  if (collaborationUndoAdapter) {
    return new CollaborationBackendUndoManager(diagram, collaborationUndoAdapter);
  } else {
    return new DefaultUndoManager(diagram);
  }
};
