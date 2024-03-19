import { ActionMapFactory, AppState, defaultCanvasActions } from '../base-ui/keyMap.ts';
import { ToggleDarkModeAction } from './actions/toggleDarkMode.ts';
import { ZoomAction } from './actions/zoomAction.ts';

export const defaultAppActions: ActionMapFactory = (state: AppState) => ({
  ...defaultCanvasActions(state),
  TOGGLE_DARK_MODE: new ToggleDarkModeAction(),
  ZOOM_IN: new ZoomAction(state.diagram, 'in'),
  ZOOM_OUT: new ZoomAction(state.diagram, 'out')
});
