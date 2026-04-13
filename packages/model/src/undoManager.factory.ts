import type { Diagram } from './diagram';
import type { UndoManager } from './undoManager';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { DefaultUndoManager } from './undoManager.default';
import { CollaborationBackendUndoManager } from './undoManager.collaboration';

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
