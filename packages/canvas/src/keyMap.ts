import { Diagram } from '@diagram-craft/model';
import { ApplicationState } from './ApplicationState.ts';
import { UserState } from './UserState.ts';
import { Action, ActionContext, ActionEvents, ToggleAction } from './action.ts';
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

export const makeActionMap = (...factories: ActionMapFactory[]): ActionMapFactory => {
  return (state: AppState) => {
    const actions: Partial<ActionMap> = {};
    for (const factory of factories) {
      Object.assign(actions, factory(state));
    }
    return actions;
  };
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
