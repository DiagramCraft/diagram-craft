import { undoActions } from './actions/undoAction.ts';
import { redoActions } from './actions/redoAction.ts';
import { selectAllActions } from './actions/selectAllAction.ts';
import { alignActions } from './actions/alignAction.ts';
import { toggleMagnetTypeActions } from './actions/toggleMagnetTypeAction.ts';
import { distributeActions } from './actions/distributeAction.ts';
import { waypointAddActions } from './actions/waypointAddAction.ts';
import { waypointDeleteActions } from './actions/waypointDeleteAction.ts';
import { toggleRulerActions } from './actions/toggleRulerAction.ts';
import { selectionDeleteActions } from './actions/selectionDeleteAction.ts';
import { selectionRestackActions } from './actions/selectionRestackAction.ts';
import { clipboardActions } from './actions/clipboardAction.ts';
import { textActions } from './actions/textActions.ts';
import { edgeFlipActions } from './actions/edgeFlipAction.ts';
import { duplicateActions } from './actions/duplicateAction.ts';
import { Diagram } from '@diagram-craft/model';
import { edgeTextAddActions } from './actions/edgeTextAddAction.ts';
import { ApplicationState } from './ApplicationState.ts';
import { UserState } from './UserState.ts';
import { groupActions } from './actions/groupAction.ts';
import { saveActions } from './actions/saveAction.ts';
import { Action, ActionContext, ActionEvents, ToggleAction } from './action.ts';
import { layerActions } from './actions/layerActions.ts';
import { EventEmitter } from '@diagram-craft/utils';

export type State = {
  diagram: Diagram;
};

export type AppState = State & {
  applicationState: ApplicationState;
  userState: UserState;
};

export type KeyMap = Record<string, keyof ActionMap>;

declare global {
  interface ActionMap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extends Record<string, (Action<any> | ToggleAction<any>) & EventEmitter<ActionEvents>> {}
}

export type Actions = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
};

export type ActionMapFactory = (state: AppState) => Partial<ActionMap>;

export type ActionName = keyof ActionMap & string;

export const defaultCanvasActions: ActionMapFactory = (state: AppState) => ({
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
  ...duplicateActions(state),
  ...groupActions(state),
  ...saveActions(state),
  ...layerActions(state)
});

export const makeActionMap = (...factories: ActionMapFactory[]): ActionMapFactory => {
  return (state: AppState) => {
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
  'Backspace': 'SELECTION_DELETE',
  'M-Digit1': 'TOOL_MOVE',
  'M-Digit4': 'TOOL_TEXT',
  'M-Digit3': 'TOOL_EDGE',
  'M-Digit6': 'TOOL_PEN',
  'M-Digit7': 'TOOL_NODE',
  'M-KeyS': 'FILE_SAVE',

  'M-KeyG': 'GROUP_GROUP',
  'MS-KeyG': 'GROUP_UNGROUP'
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

  if (target.tagName === 'INPUT' || (target.tagName === 'TEXTAREA' && target.id !== 'clipboard'))
    return false;

  if (target.classList.contains('svg-node__text')) return false;
  const action = findAction(e, keyMap, actionMap);
  if (!action || !action.isEnabled) return false;

  action.execute(actionContext);

  e.preventDefault();

  return true;
};

export const findKeyBindings = (action: keyof ActionMap, keyMap: KeyMap): string[] => {
  return Object.entries(keyMap)
    .filter(([, a]) => a === action)
    .map(([k]) => k);
};

export const formatKeyBinding = (s: string | undefined) => {
  if (!s) return '';
  const [m, k] = s.split('-');

  if (window.navigator.platform.indexOf('Mac') != -1) {
    return (
      m.replace('M', '⌘').replace('A', '⌥').replace('C', '⌃').replace('S', '⇧') +
      k.replace('Key', '').replace('Digit', '')
    );
  } else if (window.navigator.platform.indexOf('Linux') != -1) {
    return (
      m.replace('M', 'Ctrl').replace('A', 'Alt').replace('C', 'Ctrl').replace('S', 'Shift') +
      '+' +
      k.replace('Key', '').replace('Digit', '')
    );
  } else {
    return (
      m.replace('M', 'Ctrl').replace('A', 'Alt').replace('C', 'Ctrl').replace('S', 'Shift') +
      '+' +
      k.replace('Key', '').replace('Digit', '')
    );
  }
};
