import type { DiagramBrowserFolderItem } from '../DiagramCard';
import type { DiagramBrowserItem } from './DiagramBrowserView';

export type DiagramBrowserRow =
  | { kind: 'folder'; folder: DiagramBrowserFolderItem }
  | { kind: 'item'; item: DiagramBrowserItem };

/** Subfolders first, then files, as one flat list for the list view table */
export const buildDiagramBrowserRows = (
  subfolders: DiagramBrowserFolderItem[],
  listItems: DiagramBrowserItem[]
): DiagramBrowserRow[] => [
  ...subfolders.map((folder): DiagramBrowserRow => ({ kind: 'folder', folder })),
  ...listItems.map((item): DiagramBrowserRow => ({ kind: 'item', item }))
];

export const diagramBrowserRowId = (row: DiagramBrowserRow): string =>
  row.kind === 'folder' ? `folder:${row.folder.path}` : `file:${row.item.file.path}`;
