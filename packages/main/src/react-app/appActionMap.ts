import { toggleDarkModeActions } from './actions/toggleDarkMode';
import { zoomActions } from './actions/zoomAction';
import { sidebarActions } from './actions/SidebarAction';
import { ActionMapFactory, KeyMap } from '@diagram-craft/canvas/keyMap';
import { canvasAppActions, defaultMacKeymap } from '@diagram-craft/canvas-app/canvasAppActions';
import { toggleHelpActions } from './actions/toggleHelp';
import { fileNewActions } from './actions/fileNewAction';
import { fileOpenActions } from './actions/fileOpenAction';
import { fileSaveActions } from './actions/fileSaveAction';
import { fileSaveAsActions } from './actions/fileSaveAsAction';
import { imageInsertActions } from './actions/imageInsertAction';
import { tableInsertActions } from './actions/tableInsertAction';
import { Application } from '../application';
import { toolActions } from '../toolAction';
import { externalDataActions } from './actions/externalDataActions';
import { previewActions } from './actions/previewAction';
import { shapeInsertActions } from './actions/shapeInsertAction';
import { selectionChangeShapeActions } from './actions/selectionChangeShapeAction';
import { selectionExecuteActionActions } from './actions/selectionExecuteActionAction';
import { diagramActions } from './actions/diagramActions';
import { geometryActions } from './actions/geometryActions';
import { toggleRulerActions } from './actions/toggleRulerAction';
import { toggleContainerBorderActions } from './actions/toggleContainerBorderAction';
import { commentActions } from './actions/commentActions';
import { commandPaletteActions } from './actions/commandPaletteAction';
import { modelCenterActions } from './actions/modelCenterAction';
import { selectionAddToModificationLayerActions } from './actions/selectionAddToModificationLayerAction';
import { layoutTreeActions } from './actions/layoutTreeAction';
import { layoutForceDirectedActions } from './actions/layoutForceDirectedAction';
import { layoutLayeredActions } from './actions/layoutLayeredAction';
import { layoutOrthogonalActions } from './actions/layoutOrthogonalAction';
import { layoutSeriesParallelActions } from './actions/layoutSeriesParallelAction';
import { autoAlignActions } from './actions/autoAlignAction';

export const defaultAppActions: ActionMapFactory<Application> = application => ({
  ...toolActions(application),
  ...canvasAppActions(application),
  ...toggleHelpActions(application),
  ...toggleDarkModeActions(application),
  ...previewActions(application),
  ...zoomActions(application),
  ...sidebarActions(application),
  ...fileOpenActions(application),
  ...fileNewActions(application),
  ...fileSaveActions(application),
  ...fileSaveAsActions(application),
  ...imageInsertActions(application),
  ...shapeInsertActions(application),
  ...tableInsertActions(application),
  ...externalDataActions(application),
  ...selectionChangeShapeActions(application),
  ...selectionExecuteActionActions(application),
  ...diagramActions(application),
  ...geometryActions(application),
  ...toggleRulerActions(application),
  ...toggleContainerBorderActions(application),
  ...commentActions(application),
  ...commandPaletteActions(application),
  ...modelCenterActions(application),
  ...selectionAddToModificationLayerActions(application),
  ...layoutTreeActions(application),
  ...layoutForceDirectedActions(application),
  ...layoutLayeredActions(application),
  ...layoutOrthogonalActions(application),
  ...layoutSeriesParallelActions(application),
  ...autoAlignActions(application)
});

export const defaultMacAppKeymap: KeyMap = {
  ...defaultMacKeymap,

  'M-Digit1': 'TOOL_MOVE',
  'M-Digit2': 'TOOL_RECT',
  'M-Digit3': 'TOOL_EDGE',
  'M-Digit4': 'TOOL_TEXT',
  'M-Digit5': 'TOOL_FREEHAND',
  'M-Digit6': 'TOOL_PEN',
  'M-Digit7': 'TOOL_NODE',

  'A-Digit1': 'SIDEBAR_OBJECTS',
  'A-Digit2': 'SIDEBAR_STRUCTURE',
  'A-Digit3': 'SIDEBAR_HISTORY',
  'A-Digit4': 'SIDEBAR_SEARCH',
  'A-Digit5': 'SIDEBAR_DIAGRAM_CODE',
  'A-Digit6': 'SIDEBAR_AI',
  'A-Digit7': 'SIDEBAR_STYLE',
  'A-Digit8': 'SIDEBAR_INFO',
  'A-Digit9': 'SIDEBAR_DATA',
  'A-Digit0': 'SIDEBAR_COMMENT',

  'M-KeyS': 'FILE_SAVE',
  'M-S-KeyS': 'FILE_SAVE_AS',
  'M-KeyN': 'FILE_NEW',
  'M-KeyK': 'COMMAND_PALETTE',

  // View Operations
  'M-Equal': 'ZOOM_IN',
  'M-Minus': 'ZOOM_OUT',
  'M-Digit0': 'ZOOM_FIT',

  'M-Slash': 'TOGGLE_HELP',
  'M-S-KeyR': 'TOGGLE_RULER',

  // Selection Operations
  'A-ArrowUp': 'SELECTION_SELECT_GROW',
  'A-ArrowDown': 'SELECTION_SELECT_SHRINK',

  // Preview and Center
  'M-S-KeyP': 'PREVIEW',
  'M-S-KeyM': 'MODEL_CENTER'
};
