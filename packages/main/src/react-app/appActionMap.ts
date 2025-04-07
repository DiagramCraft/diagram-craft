import { toggleDarkModeActions } from './actions/toggleDarkMode';
import { zoomActions } from './actions/zoomAction';
import { sidebarActions } from './actions/SidebarAction';
import { ActionMapFactory, KeyMap } from '@diagram-craft/canvas/keyMap';
import { defaultCanvasActions, defaultMacKeymap } from '@diagram-craft/canvas-app/defaultActions';
import { toggleHelpActions } from './actions/toggleHelp';
import { fileNewActions } from './actions/fileNewAction';
import { fileOpenActions } from './actions/fileOpenAction';
import { fileSaveActions } from './actions/fileSaveAction';
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

export const defaultAppActions: ActionMapFactory<Application> = application => ({
  ...toolActions(application),
  ...defaultCanvasActions(application),
  ...toggleHelpActions(application),
  ...toggleDarkModeActions(application),
  ...previewActions(application),
  ...zoomActions(application),
  ...sidebarActions(application),
  ...fileOpenActions(application),
  ...fileNewActions(application),
  ...fileSaveActions(application),
  ...imageInsertActions(application),
  ...shapeInsertActions(application),
  ...tableInsertActions(application),
  ...externalDataActions(application),
  ...selectionChangeShapeActions(application),
  ...selectionExecuteActionActions(application),
  ...diagramActions(application),
  ...geometryActions(application)
});

export const defaultMacAppKeymap: KeyMap = {
  ...defaultMacKeymap,

  'M-Digit1': 'TOOL_MOVE',
  'M-Digit4': 'TOOL_TEXT',
  'M-Digit3': 'TOOL_EDGE',
  'M-Digit6': 'TOOL_PEN',
  'M-Digit7': 'TOOL_NODE',

  'A-Digit1': 'SIDEBAR_SHAPES',
  'A-Digit2': 'SIDEBAR_LAYERS',
  'A-Digit3': 'SIDEBAR_SELECT',
  'A-Digit4': 'SIDEBAR_DOCUMENT',
  'A-Digit5': 'SIDEBAR_HISTORY',
  'A-Digit6': 'SIDEBAR_STYLE',
  'A-Digit7': 'SIDEBAR_INFO',
  'A-Digit8': 'SIDEBAR_DATA',

  'M-KeyS': 'FILE_SAVE',
  'M-KeyN': 'FILE_NEW'
};
