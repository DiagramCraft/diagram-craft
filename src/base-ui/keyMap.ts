import { undoActions } from './actions/undoAction.ts';
import { redoActions } from './actions/redoAction.ts';
import { Emitter } from '../utils/event.ts';
import { selectAllActions } from './actions/selectAllAction.ts';
import { alignActions } from './actions/alignAction.ts';
import { toggleMagnetTypeActions } from './actions/toggleMagnetTypeAction.ts';
import { distributeActions } from './actions/distributeAction.ts';
import { Point } from '../geometry/point.ts';
import { waypointAddActions } from './actions/waypointAddAction.ts';
import { waypointDeleteActions } from './actions/waypointDeleteAction.ts';
import { toggleRulerActions } from './actions/toggleRulerAction.ts';
import { selectionDeleteActions } from './actions/selectionDeleteAction.ts';
import { selectionRestackActions } from './actions/selectionRestackAction.ts';
import { clipboardActions } from './actions/clipboardAction.ts';
import { textActions } from './actions/textActions.ts';
import { edgeFlipActions } from './actions/edgeFlipAction.ts';
import { duplicateActions } from './actions/duplicateAction.ts';
import { Diagram } from '../model/diagram.ts';
import { edgeTextAddActions } from './actions/edgeTextAddAction.ts';

export type ActionEvents = {
  actionchanged: { action: Action };
  actiontriggered: { action: Action };
};

export type ActionContext = {
  point?: Point;
  id?: string;
};

export interface Action extends Emitter<ActionEvents> {
  execute: (context: ActionContext) => void;
  enabled: boolean;
}

export interface ToggleAction extends Action {
  state: boolean;
}

export type State = {
  diagram: Diagram;
};

export type KeyMap = Record<string, keyof ActionMap>;

declare global {
  interface ActionMap {}
}

export type ActionMapFactory = (state: State) => Partial<ActionMap>;

export const defaultCanvasActions: ActionMapFactory = (state: State) => ({
  ...edgeTextAddActions(state),
  ...clipboardActions(state),
  ...undoActions(state),
  ...redoActions(state),
  ...selectAllActions(state),
  ...selectionDeleteActions(state),
  ...selectionRestackActions(state),
  ...alignActions(state),
  ...toggleMagnetTypeActions(state),
  ...distributeActions(state),
  ...waypointAddActions(state),
  ...waypointDeleteActions(state),
  ...toggleRulerActions(state),
  ...textActions(state),
  ...edgeFlipActions(state),
  ...duplicateActions(state)
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
  'MS-KeyZ': 'REDO',
  'M-KeyC': 'CLIPBOARD_COPY',
  'M-KeyX': 'CLIPBOARD_CUT',
  'M-KeyV': 'CLIPBOARD_PASTE',
  'M-KeyD': 'DUPLICATE',
  Backspace: 'SELECTION_DELETE'
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
  actionContext: ActionContext,
  keyMap: KeyMap,
  actionMap: Partial<ActionMap>
): boolean => {
  const target: HTMLElement = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return false;

  if (target.classList?.contains('svg-node__text')) return false;

  const action = findAction(e, keyMap, actionMap);
  if (!action || !action.enabled) return false;

  action.execute(actionContext);

  e.preventDefault();

  return true;
};

export const findKeyBindings = (action: keyof ActionMap, keyMap: KeyMap): string[] => {
  return Object.entries(keyMap)
    .filter(([, a]) => a === action)
    .map(([k]) => k);
};
