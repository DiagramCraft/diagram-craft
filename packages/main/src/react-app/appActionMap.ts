import { ToggleDarkModeAction } from './actions/toggleDarkMode';
import { ZoomAction } from './actions/zoomAction';
import { sidebarActions } from './actions/SidebarAction';
import { ActionMapFactory, AppState, KeyMap } from '@diagram-craft/canvas/keyMap';
import { defaultCanvasActions, defaultMacKeymap } from '@diagram-craft/canvas-app/defaultActions';

export const defaultAppActions: ActionMapFactory = (state: AppState) => ({
  ...defaultCanvasActions(state),
  TOGGLE_DARK_MODE: new ToggleDarkModeAction(),
  ZOOM_IN: new ZoomAction(state.diagram, 'in'),
  ZOOM_OUT: new ZoomAction(state.diagram, 'out'),

  ...sidebarActions(state)
});

export const defaultMacAppKeymap: KeyMap = {
  ...defaultMacKeymap,

  'A-Digit1': 'SIDEBAR_SHAPES',
  'A-Digit2': 'SIDEBAR_LAYERS',
  'A-Digit3': 'SIDEBAR_SELECT',
  'A-Digit4': 'SIDEBAR_DOCUMENT',
  'A-Digit5': 'SIDEBAR_HISTORY',
  'A-Digit6': 'SIDEBAR_STYLE',
  'A-Digit7': 'SIDEBAR_INFO',
  'A-Digit8': 'SIDEBAR_DATA'
};
