import { edgeTextAddActions } from '@diagram-craft/canvas/actions/edgeTextAddAction';
import { clipboardActions } from '@diagram-craft/canvas/actions/clipboardAction';
import { undoActions } from '@diagram-craft/canvas/actions/undoAction';
import { redoActions } from '@diagram-craft/canvas/actions/redoAction';
import { selectAllActions } from '@diagram-craft/canvas/actions/selectAllAction';
import { selectionDeleteActions } from '@diagram-craft/canvas/actions/selectionDeleteAction';
import { selectionRestackActions } from '@diagram-craft/canvas/actions/selectionRestackAction';
import { alignActions } from '@diagram-craft/canvas/actions/alignAction';
import { toggleMagnetTypeActions } from '@diagram-craft/canvas/actions/toggleMagnetTypeAction';
import { distributeActions } from '@diagram-craft/canvas/actions/distributeAction';
import { waypointAddActions } from '@diagram-craft/canvas/actions/waypointAddAction';
import { waypointDeleteActions } from '@diagram-craft/canvas/actions/waypointDeleteAction';
import { toggleRulerActions } from '@diagram-craft/canvas/actions/toggleRulerAction';
import { textActions } from '@diagram-craft/canvas/actions/textActions';
import { edgeFlipActions } from '@diagram-craft/canvas/actions/edgeFlipAction';
import { duplicateActions } from '@diagram-craft/canvas/actions/duplicateAction';
import { saveActions } from '@diagram-craft/canvas/actions/saveAction';
import { layerActions } from '@diagram-craft/canvas/actions/layerActions';
import { toolActions } from '@diagram-craft/canvas/actions/toolAction';
import { ActionMapFactory, AppState, KeyMap } from '@diagram-craft/canvas/src/keyMap';
import { groupActions } from '@diagram-craft/canvas/actions/groupAction';

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
