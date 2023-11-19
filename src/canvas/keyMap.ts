import { UndoAction } from './actions/undoAction.ts';
import { RedoAction } from './actions/redoAction.ts';
import { Emitter } from '../utils/event.ts';
import { SelectAllAction } from './actions/selectAllAction.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';

export type ActionEvents = {
  actionchanged: { action: Action };
  actiontriggered: { action: Action };
};

export interface Action extends Emitter<ActionEvents> {
  execute: () => void;
  enabled: boolean;
}

export interface ToggleAction extends Action {
  state: boolean;
}

type State = {
  diagram: EditableDiagram;
};

export type KeyMap = Record<string, keyof ActionMap>;

declare global {
  interface ActionMap {}
}

export type ActionMapFactory = (state: State) => Partial<ActionMap>;

export const defaultCanvasActions: ActionMapFactory = (state: State) => ({
  UNDO: new UndoAction(state.diagram),
  REDO: new RedoAction(state.diagram),
  SELECT_ALL: new SelectAllAction(state.diagram, 'all'),
  SELECT_ALL_NODES: new SelectAllAction(state.diagram, 'nodes'),
  SELECT_ALL_EDGES: new SelectAllAction(state.diagram, 'edges')
});

export const makeActionMap = (...factories: ActionMapFactory[]): ActionMapFactory => {
  return (state: State) => {
    const actions: Partial<ActionMap> = {};
    for (const factory of factories) {
      Object.assign(actions, factory(state));
    }
    return actions;
  };
};

export const defaultMacKeymap: KeyMap = {
  'M-KeyZ': 'UNDO',
  'MS-KeyZ': 'REDO'
};

export const findAction = (
  e: KeyboardEvent,
  keyMap: KeyMap,
  actionMap: Partial<ActionMap>
): Action | undefined => {
  const actionKey = `${e.altKey ? 'A' : ''}${e.ctrlKey ? 'C' : ''}${e.metaKey ? 'M' : ''}${
    e.shiftKey ? 'S' : ''
  }-${e.code}`;
  if (actionKey.startsWith('-')) return actionMap[keyMap[actionKey.slice(1)]];
  return actionMap[keyMap[actionKey]];
};

export const executeAction = (
  e: KeyboardEvent,
  keyMap: KeyMap,
  actionMap: Partial<ActionMap>
): boolean => {
  const action = findAction(e, keyMap, actionMap);
  if (!action || !action.enabled) return false;

  action.execute();
  return true;
};

export const findKeyBindings = (action: keyof ActionMap, keyMap: KeyMap): string[] => {
  return Object.entries(keyMap)
    .filter(([_, a]) => a === action)
    .map(([k, _]) => k);
};
