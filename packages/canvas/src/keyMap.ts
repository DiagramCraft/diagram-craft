import { ApplicationState } from './ApplicationState';
import { Action, ActionContext, ActionEvents, ToggleAction } from './action';
import { EventEmitter } from '@diagram-craft/utils/event';
import { Diagram } from '@diagram-craft/model/diagram';

export type State = {
  diagram: Diagram;
};

export type AppState = State & {
  applicationState: ApplicationState;
};

type Alt = 'A-' | '';
type Control = 'C-' | '';
type Meta = 'M-' | '';
type Shift = 'S-' | '';
type KeyCode =
  | `Key${Uppercase<string>}`
  | 'Space'
  | 'Backspace'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | `Digit${number}`;

type KeyBinding = `${Alt}${Control}${Meta}${Shift}${KeyCode}` | KeyCode;

const ALT = 'A-';
const CTRL = 'C-';
const META = 'M-';
const SHIFT = 'S-';

export type KeyMap = Partial<Record<KeyBinding, keyof ActionMap>>;

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

const findAction = (
  e: KeyboardEvent,
  keyMap: KeyMap,
  actionMap: Partial<ActionMap>
): Action | undefined => {
  const actionKey: KeyBinding = `${e.altKey ? ALT : ''}${e.ctrlKey ? CTRL : ''}${e.metaKey ? META : ''}${
    e.shiftKey ? SHIFT : ''
  }${e.code as KeyCode}`;

  return actionMap[keyMap[actionKey]!];
};

export const findAndExecuteAction = (
  e: KeyboardEvent,
  actionContext: ActionContext,
  keyMap: KeyMap,
  actionMap: Partial<ActionMap>
): boolean => {
  const target: HTMLElement = e.target as HTMLElement;

  // TODO: Is this really the right place for this logic
  if (target.tagName === 'INPUT' || (target.tagName === 'TEXTAREA' && target.id !== 'clipboard'))
    return false;
  if (target.classList.contains('svg-node__text')) return false;

  const action = findAction(e, keyMap, actionMap);
  if (action === undefined) return false;

  action.execute({ ...actionContext, source: 'keyboard' });

  e.preventDefault();

  return true;
};

export const findKeyBindingsForAction = (action: keyof ActionMap, keyMap: KeyMap): KeyBinding[] => {
  return Object.entries(keyMap)
    .filter(([, a]) => a === action)
    .map(([k]) => k as KeyBinding);
};

type FormattingConfig = Record<typeof ALT | typeof CTRL | typeof META | typeof SHIFT, string>;

const FORMATTING_MAC: FormattingConfig = { [ALT]: '⌥', [CTRL]: '⌃', [META]: '⌘', [SHIFT]: '⇧' };

const FORMATTING_LINUX: FormattingConfig = {
  [ALT]: 'Alt+',
  [CTRL]: 'Ctrl+',
  [META]: 'Meta+',
  [SHIFT]: 'Shift+'
};

const FORMATTING_WINDOWS: FormattingConfig = {
  [ALT]: 'Alt+',
  [CTRL]: 'Ctrl+',
  [META]: 'Win+',
  [SHIFT]: 'Shift+'
};

export const formatKeyBinding = (
  s: KeyBinding | undefined,
  platform = window.navigator.platform
) => {
  if (!s) return '';

  const formatted = s.replace('Key', '').replace('Digit', '');

  let formattingConfig = FORMATTING_WINDOWS;
  if (platform.indexOf('Mac') != -1) {
    formattingConfig = FORMATTING_MAC;
  } else if (platform.indexOf('Linux') != -1) {
    formattingConfig = FORMATTING_LINUX;
  }

  return formatted
    .replace(ALT, formattingConfig[ALT])
    .replace(CTRL, formattingConfig[CTRL])
    .replace(META, formattingConfig[META])
    .replace(SHIFT, formattingConfig[SHIFT]);
};
