import type React from 'react';
import { TbFile, TbFileText } from 'react-icons/tb';
import type { FileEntry } from './api';

export type ContentNodeType = FileEntry['type']; // 'diagram' | 'folder' | 'markdown' | 'file'

export type MenuTarget =
  | { type: 'diagram'; file: FileEntry }
  | { type: 'markdown'; file: FileEntry }
  | { type: 'file'; file: FileEntry }
  | { type: 'folder'; path: string };

/** Convert a file's type to its non-folder MenuTarget discriminant */
export const fileMenuTargetType = (type: ContentNodeType): 'diagram' | 'markdown' | 'file' =>
  type === 'markdown' ? 'markdown' : type === 'file' ? 'file' : 'diagram';

/** Icon for a file node in tree/list views */
export const getFileNodeIcon = (type: ContentNodeType, size = 13): React.ReactElement =>
  type === 'markdown' ? <TbFileText size={size} /> : <TbFile size={size} />;

/** Human-readable label for rename / delete dialogs */
export const entityTypeLabel = (type: ContentNodeType): string =>
  type === 'folder' ? 'folder' : type === 'markdown' ? 'document' : type === 'file' ? 'file' : 'diagram';

/** Delete dialog title */
export const deleteTitle = (type: ContentNodeType): string => `Delete ${entityTypeLabel(type)}?`;

/** Delete dialog confirm-button label */
export const deleteConfirmLabel = (type: ContentNodeType): string =>
  `Delete ${entityTypeLabel(type)}`;

/** Delete dialog body message */
export const deleteMessage = (target: MenuTarget): React.ReactNode => {
  if (target.type === 'folder')
    return (
      <>
        The folder <b>{target.path}</b> and all diagrams inside it will be permanently deleted.
      </>
    );
  if (target.type === 'markdown')
    return <>The document <b>{target.file.name}</b> will be permanently deleted.</>;
  if (target.type === 'file')
    return (
      <>
        The file <b>{target.file.original_filename ?? target.file.name}</b> will be permanently
        deleted.
      </>
    );
  return <>The diagram <b>{target.file.name}</b> will be permanently deleted.</>;
};
