import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import { $tStr } from '@diagram-craft/utils/localize';
import { AppConfig } from '../appConfig';

export const mainMenuStructure: MenuEntry[] = [
  {
    id: 'file',
    label: $tStr('menu.file', 'File'),
    type: 'submenu',
    submenu: [
      {
        id: 'new',
        label: $tStr('menu.file.new', 'New'),
        action: 'FILE_NEW',
        type: 'action'
      },
      ...(AppConfig.get().filesystem.provider === 'none'
        ? []
        : ([
            {
              id: 'open',
              label: $tStr('menu.file.open', 'Open...'),
              action: 'FILE_OPEN',
              type: 'action'
            },
            {
              id: 'recent',
              label: $tStr('menu.file.open_recent', 'Open Recent...'),
              type: 'recent'
            },
            {
              id: 'save',
              label: $tStr('menu.file.save', 'Save'),
              action: 'FILE_SAVE',
              type: 'action'
            },
            {
              id: 'save-as',
              label: $tStr('menu.file.save_as', 'Save As...'),
              action: 'FILE_SAVE_AS',
              type: 'action'
            }
          ] as MenuEntry[])),
      {
        id: 's1',
        label: '',
        type: 'separator'
      },
      {
        id: 'export',
        label: $tStr('menu.file.export', 'Export...'),
        type: 'submenu',
        submenu: [
          {
            id: 'export-image',
            label: $tStr('menu.file.export_png', 'Export as PNG...'),
            action: 'FILE_EXPORT_IMAGE',
            type: 'action'
          },
          {
            id: 'export-svg',
            label: $tStr('menu.file.export_svg', 'Export as SVG...'),
            action: 'FILE_EXPORT_SVG',
            type: 'action'
          }
        ]
      }
    ]
  },
  {
    id: 'edit',
    label: $tStr('menu.edit', 'Edit'),
    type: 'submenu',
    submenu: [
      {
        id: 'undo',
        label: $tStr('menu.edit.undo', 'Undo'),
        action: 'UNDO',
        type: 'action'
      },
      {
        id: 'redo',
        label: $tStr('menu.edit.redo', 'Redo'),
        action: 'REDO',
        type: 'action'
      },
      {
        id: 's1',
        label: '',
        type: 'separator'
      },
      {
        id: 'cut',
        label: $tStr('menu.edit.cut', 'Cut'),
        action: 'CLIPBOARD_CUT',
        type: 'action'
      },
      {
        id: 'copy',
        label: $tStr('menu.edit.copy', 'Copy'),
        action: 'CLIPBOARD_COPY',
        type: 'action'
      },
      {
        id: 'label',
        label: $tStr('menu.edit.duplicate', 'Duplicate'),
        action: 'DUPLICATE',
        type: 'action'
      }
    ]
  },
  {
    id: 'view',
    label: $tStr('menu.view', 'View'),
    type: 'submenu',
    submenu: [
      {
        id: 'zoom-in',
        label: $tStr('menu.view.zoom_in', 'Zoom In'),
        action: 'ZOOM_IN',
        type: 'action'
      },
      {
        id: 'zoom-out',
        label: $tStr('menu.view.zoom_out', 'Zoom Out'),
        action: 'ZOOM_OUT',
        type: 'action'
      },
      {
        id: 's2',
        label: '',
        type: 'separator'
      },
      {
        id: 'ruler',
        label: $tStr('menu.view.ruler', 'Ruler'),
        action: 'TOGGLE_RULER',
        type: 'toggle'
      },
      {
        id: 'help',
        label: $tStr('menu.view.help', 'Help'),
        action: 'TOGGLE_HELP',
        type: 'toggle'
      },
      {
        id: 'dark-mode',
        label: $tStr('menu.view.dark_mode', 'Dark Mode'),
        action: 'TOGGLE_DARK_MODE',
        type: 'toggle'
      }
    ]
  }
];
