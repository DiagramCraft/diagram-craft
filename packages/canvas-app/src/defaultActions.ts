import { edgeTextAddActions } from '@diagram-craft/canvas/actions/edgeTextAddAction';
import { clipboardActions } from './actions/clipboardAction';
import { undoActions } from './actions/undoAction';
import { redoActions } from './actions/redoAction';
import { selectAllActions } from './actions/selectAllAction';
import { selectionDeleteActions } from './actions/selectionDeleteAction';
import { selectionRestackActions } from './actions/selectionRestackAction';
import { alignActions } from './actions/alignAction';
import { toggleMagnetTypeActions } from './actions/toggleMagnetTypeAction';
import { distributeActions } from './actions/distributeAction';
import { waypointAddActions } from './actions/waypointAddAction';
import { waypointDeleteActions } from '@diagram-craft/canvas/actions/waypointDeleteAction';
import { textActions } from './actions/textActions';
import { edgeFlipActions } from './actions/edgeFlipAction';
import { duplicateActions } from './actions/duplicateAction';
import { debugActions } from './actions/debugActions';
import { layerActions } from './actions/layerActions';
import { ActionMapFactory, KeyMap } from '@diagram-craft/canvas/src/keyMap';
import { groupActions } from './actions/groupAction';
import { tableActions } from '@diagram-craft/canvas/actions/tableActions';
import { selectionMoveActions } from './actions/selectionMoveAction';
import { selectionResizeActions } from './actions/selectionResizeAction';
import { createLinkedNodeActions } from './actions/linkedNodeAction';
import { exportActions } from './actions/exportAction';
import { styleCopyActions } from './actions/styleCopyAction';
import { ruleLayerActions } from './actions/ruleLayerActions';
import { Application } from './application';
import { createNavigateNodeActions } from './actions/navigateNodeAction';

export const defaultCanvasActions: ActionMapFactory<Application> = application => ({
  ...edgeTextAddActions(application),
  ...tableActions(application),
  ...clipboardActions(application),
  ...styleCopyActions(application),
  ...undoActions(application),
  ...redoActions(application),
  ...selectAllActions(application),
  ...selectionDeleteActions(application),
  ...selectionMoveActions(application),
  ...selectionResizeActions(application),
  ...createLinkedNodeActions(application),
  ...createNavigateNodeActions(application),
  ...selectionRestackActions(application),
  ...alignActions(application),
  ...toggleMagnetTypeActions(application),
  ...distributeActions(application),
  ...waypointAddActions(application),
  ...waypointDeleteActions(application),
  ...textActions(application),
  ...edgeFlipActions(application),
  ...duplicateActions(application),
  ...groupActions(application),
  ...debugActions(application),
  ...exportActions(application),
  ...layerActions(application),
  ...ruleLayerActions(application)
});

export const defaultMacKeymap: KeyMap = {
  'M-KeyZ': 'UNDO',
  'M-S-KeyZ': 'REDO',
  'M-KeyC': 'CLIPBOARD_COPY',
  'M-KeyX': 'CLIPBOARD_CUT',
  'M-KeyV': 'CLIPBOARD_PASTE',
  'M-KeyD': 'DUPLICATE',
  'Backspace': 'SELECTION_DELETE',
  'M-KeyO': 'FILE_OPEN',
  'M-KeyE': 'FILE_EXPORT_IMAGE',

  'M-KeyG': 'GROUP_GROUP',
  'M-S-KeyG': 'GROUP_UNGROUP',

  'ArrowRight': 'SELECTION_MOVE_RIGHT',
  'ArrowLeft': 'SELECTION_MOVE_LEFT',
  'ArrowUp': 'SELECTION_MOVE_UP',
  'ArrowDown': 'SELECTION_MOVE_DOWN',
  'S-ArrowRight': 'SELECTION_MOVE_GRID_RIGHT',
  'S-ArrowLeft': 'SELECTION_MOVE_GRID_LEFT',
  'S-ArrowUp': 'SELECTION_MOVE_GRID_UP',
  'S-ArrowDown': 'SELECTION_MOVE_GRID_DOWN',

  'M-ArrowRight': 'SELECTION_RESIZE_RIGHT',
  'M-ArrowLeft': 'SELECTION_RESIZE_LEFT',
  'M-ArrowUp': 'SELECTION_RESIZE_UP',
  'M-ArrowDown': 'SELECTION_RESIZE_DOWN',
  'M-S-ArrowRight': 'SELECTION_RESIZE_GRID_RIGHT',
  'M-S-ArrowLeft': 'SELECTION_RESIZE_GRID_LEFT',
  'M-S-ArrowUp': 'SELECTION_RESIZE_GRID_UP',
  'M-S-ArrowDown': 'SELECTION_RESIZE_GRID_DOWN',

  'A-C-ArrowUp': 'CREATE_LINKED_NODE_N',
  'A-C-ArrowDown': 'CREATE_LINKED_NODE_S',
  'A-C-ArrowLeft': 'CREATE_LINKED_NODE_W',
  'A-C-ArrowRight': 'CREATE_LINKED_NODE_E',
  'A-C-S-ArrowUp': 'CREATE_LINKED_NODE_KEEP_N',
  'A-C-S-ArrowDown': 'CREATE_LINKED_NODE_KEEP_S',
  'A-C-S-ArrowLeft': 'CREATE_LINKED_NODE_KEEP_W',
  'A-C-S-ArrowRight': 'CREATE_LINKED_NODE_KEEP_E',

  'C-M-ArrowUp': 'NAVIGATE_NODE_N',
  'C-M-ArrowDown': 'NAVIGATE_NODE_S',
  'C-M-ArrowLeft': 'NAVIGATE_NODE_W',
  'C-M-ArrowRight': 'NAVIGATE_NODE_E',
  'C-M-S-ArrowUp': 'NAVIGATE_NODE_EXTEND_N',
  'C-M-S-ArrowDown': 'NAVIGATE_NODE_EXTEND_S',
  'C-M-S-ArrowLeft': 'NAVIGATE_NODE_EXTEND_W',
  'C-M-S-ArrowRight': 'NAVIGATE_NODE_EXTEND_E',

  'M-S-KeyC': 'STYLE_COPY',
  'M-S-KeyV': 'STYLE_PASTE',

  // Selection
  'M-KeyA': 'SELECT_ALL',
  'M-S-KeyA': 'SELECT_ALL_NODES',

  // Alignment
  'A-C-KeyL': 'ALIGN_LEFT',
  'A-C-KeyR': 'ALIGN_RIGHT',
  'A-C-KeyT': 'ALIGN_TOP',
  'A-C-KeyB': 'ALIGN_BOTTOM',
  'A-C-KeyC': 'ALIGN_CENTER_VERTICAL',
  'A-C-KeyM': 'ALIGN_CENTER_HORIZONTAL',

  // Distribution
  'A-C-KeyH': 'DISTRIBUTE_HORIZONTAL',
  'A-C-KeyV': 'DISTRIBUTE_VERTICAL',

  // Text
  'M-KeyB': 'TEXT_BOLD',
  'M-KeyI': 'TEXT_ITALIC',
  'M-KeyU': 'TEXT_UNDERLINE'
};
