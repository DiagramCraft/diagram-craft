import {
  AbstractAction,
  Action,
  ActionContext,
  ActionEvents,
  BaseActionArgs,
  ToggleAction
} from './action';
import { EventEmitter } from '@diagram-craft/utils/event';

type Alt = 'A-' | '';
type Control = 'C-' | '';
type Meta = 'M-' | '';
type Shift = 'S-' | '';
type KeyCode =
  | `Key${Uppercase<string>}`
  | 'Space'
  | 'Backspace'
  | 'Equal'
  | 'Minus'
  | 'Slash'
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

export type ActionMapFactory<A extends ActionContext = ActionContext> = (
  context: A
) => Partial<ActionMap>;

export type ActionName = keyof ActionMap & string;

export const makeActionMap = <K extends ActionContext>(
  ...factories: ActionMapFactory<K>[]
): ActionMapFactory<K> => {
  return (context: K) => {
    const actions: Partial<ActionMap> = {};
    for (const factory of factories) {
      Object.assign(actions, factory(context));
    }

    Object.values(actions).forEach(action => {
      if (action instanceof AbstractAction) {
        action.bindCriteria();
      }
    });

    return actions;
  };
};

const findAction = (
  e: KeyboardEvent,
  keyMap: KeyMap,
  actionMap: Partial<ActionMap>
): Action<unknown> | undefined => {
  const actionKey: KeyBinding = `${e.altKey ? ALT : ''}${e.ctrlKey ? CTRL : ''}${e.metaKey ? META : ''}${
    e.shiftKey ? SHIFT : ''
  }${e.code as KeyCode}`;

  return actionMap[keyMap[actionKey]!];
};

export const findAndExecuteAction = (
  e: KeyboardEvent,
  actionArg: Pick<BaseActionArgs, 'point'>,
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

  // TODO: Should check if the action is enabled or not

  action.execute({ ...actionArg, source: 'keyboard' });

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
  if (platform.indexOf('Mac') !== -1) {
    formattingConfig = FORMATTING_MAC;
  } else if (platform.indexOf('Linux') !== -1) {
    formattingConfig = FORMATTING_LINUX;
  }

  return formatted
    .replace(ALT, formattingConfig[ALT])
    .replace(CTRL, formattingConfig[CTRL])
    .replace(META, formattingConfig[META])
    .replace(SHIFT, formattingConfig[SHIFT]);
};
