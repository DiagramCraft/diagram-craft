import { edgeTextAddActions } from '@diagram-craft/canvas/actions/edgeTextAddAction';
import { clipboardActions } from './actions/clipboardAction.ts';
import { undoActions } from './actions/undoAction.ts';
import { redoActions } from './actions/redoAction.ts';
import { selectAllActions } from './actions/selectAllAction.ts';
import { selectionDeleteActions } from './actions/selectionDeleteAction.ts';
import { selectionRestackActions } from './actions/selectionRestackAction.ts';
import { alignActions } from './actions/alignAction.ts';
import { toggleMagnetTypeActions } from './actions/toggleMagnetTypeAction.ts';
import { distributeActions } from './actions/distributeAction.ts';
import { waypointAddActions } from './actions/waypointAddAction.ts';
import { waypointDeleteActions } from '@diagram-craft/canvas/actions/waypointDeleteAction';
import { toggleRulerActions } from './actions/toggleRulerAction.ts';
import { textActions } from './actions/textActions.ts';
import { edgeFlipActions } from './actions/edgeFlipAction.ts';
import { duplicateActions } from './actions/duplicateAction.ts';
import { saveActions } from './actions/saveAction.ts';
import { layerActions } from './actions/layerActions.ts';
import { toolActions } from './actions/toolAction.ts';
import { ActionMapFactory, AppState, KeyMap } from '@diagram-craft/canvas/src/keyMap';
import { groupActions } from './actions/groupAction.ts';

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
  ...layerActions(state),
  ...toolActions(state)
});

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
