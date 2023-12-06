import { ActionMapFactory, defaultCanvasActions, State } from '../base-ui/keyMap.ts';
import { ToggleDarkModeAction } from './actions/toggleDarkMode.ts';

export const defaultAppActions: ActionMapFactory = (state: State) => ({
  ...defaultCanvasActions(state),
  TOGGLE_DARK_MODE: new ToggleDarkModeAction()
});
