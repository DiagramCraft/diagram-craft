import { LoadedDiagram } from '../model/diagram.ts';
import { SelectionState } from '../model/selectionState.ts';
import { Drag } from './drag.ts';

export type Action = {
  execute: (diagram: LoadedDiagram, selection: SelectionState, drag?: Drag) => void;
};

export type KeyMap = Record<string, string>;
export type ActionMap = Record<string, Action>;

export const Actions: ActionMap = {
  UNDO: {
    execute: (diagram: LoadedDiagram) => {
      diagram.undoManager.undo();
    }
  },
  REDO: {
    execute: (diagram: LoadedDiagram) => {
      diagram.undoManager.redo();
    }
  }
};

export const MacKeymap: KeyMap = {
  'M-KeyZ': 'UNDO',
  'MS-KeyZ': 'REDO'
};

export const findAction = (e: KeyboardEvent, keyMap: KeyMap): Action | undefined => {
  const actionKey = `${e.altKey ? 'A' : ''}${e.ctrlKey ? 'C' : ''}${e.metaKey ? 'M' : ''}${
    e.shiftKey ? 'S' : ''
  }-${e.code}`;
  if (actionKey.startsWith('-')) return Actions[keyMap[actionKey.slice(1)]];
  return Actions[keyMap[actionKey]];
};
