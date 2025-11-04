import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import { AppConfig } from '../appConfig';

export const mainMenuStructure: MenuEntry[] = [
  {
    id: 'file',
    label: 'File',
    type: 'submenu',
    submenu: [
      {
        id: 'new',
        label: 'New',
        action: 'FILE_NEW',
        type: 'action'
      },
      ...(AppConfig.get().filesystem.provider === 'none'
        ? []
        : ([
            {
              id: 'open',
              label: 'Open...',
              action: 'FILE_OPEN',
              type: 'action'
            },
            {
              id: 'recent',
              label: 'Open Recent...',
              type: 'recent'
            },
            {
              id: 'save',
              label: 'Save',
              action: 'FILE_SAVE',
              type: 'action'
            },
            {
              id: 'save-as',
              label: 'Save As...',
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
        label: 'Export...',
        type: 'submenu',
        submenu: [
          {
            id: 'export-image',
            label: 'Export as PNG...',
            action: 'FILE_EXPORT_IMAGE',
            type: 'action'
          },
          {
            id: 'export-svg',
            label: 'Export as SVG...',
            action: 'FILE_EXPORT_SVG',
            type: 'action'
          }
        ]
      }
    ]
  },
  {
    id: 'edit',
    label: 'Edit',
    type: 'submenu',
    submenu: [
      {
        id: 'undo',
        label: 'Undo',
        action: 'UNDO',
        type: 'action'
      },
      {
        id: 'redo',
        label: 'Redo',
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
        label: 'Cut',
        action: 'CLIPBOARD_CUT',
        type: 'action'
      },
      {
        id: 'copy',
        label: 'Copy',
        action: 'CLIPBOARD_COPY',
        type: 'action'
      },
      {
        id: 'label',
        label: 'Duplicate',
        action: 'DUPLICATE',
        type: 'action'
      }
    ]
  },
  {
    id: 'view',
    label: 'View',
    type: 'submenu',
    submenu: [
      {
        id: 'zoom-in',
        label: 'Zoom In',
        action: 'ZOOM_IN',
        type: 'action'
      },
      {
        id: 'zoom-out',
        label: 'Zoom Out',
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
        label: 'Ruler',
        action: 'TOGGLE_RULER',
        type: 'toggle'
      },
      {
        id: 'help',
        label: 'Help',
        action: 'TOGGLE_HELP',
        type: 'toggle'
      },
      {
        id: 'dark-mode',
        label: 'Dark Mode',
        action: 'TOGGLE_DARK_MODE',
        type: 'toggle'
      }
    ]
  }
];
