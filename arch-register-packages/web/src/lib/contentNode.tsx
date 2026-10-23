import type React from 'react';
import type { IconType } from 'react-icons';
import {
  TbFile,
  TbFileText,
  TbFileTypeDoc,
  TbFileTypeDocx,
  TbFileTypePdf,
  TbFileTypePpt,
  TbFileTypeTxt,
  TbFileTypeXls,
  TbPhoto
} from 'react-icons/tb';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';

export type ContentNodeType = ProjectFile['type']; // 'diagram' | 'folder' | 'markdown' | 'file'

export type MenuTarget =
  | { type: 'diagram'; file: ProjectFile }
  | { type: 'markdown'; file: ProjectFile }
  | { type: 'file'; file: ProjectFile }
  | { type: 'folder'; path: string };

/** Convert a file's type to its non-folder MenuTarget discriminant */
export const fileMenuTargetType = (type: ContentNodeType): 'diagram' | 'markdown' | 'file' =>
  type === 'markdown' ? 'markdown' : type === 'file' ? 'file' : 'diagram';

const FILE_EXTENSION_ICONS: Record<string, IconType> = {
  ppt: TbFileTypePpt,
  pptx: TbFileTypePpt,
  doc: TbFileTypeDoc,
  docx: TbFileTypeDocx,
  xls: TbFileTypeXls,
  xlsx: TbFileTypeXls,
  pdf: TbFileTypePdf,
  txt: TbFileTypeTxt,
  png: TbPhoto,
  jpg: TbPhoto,
  jpeg: TbPhoto,
  gif: TbPhoto,
  svg: TbPhoto,
  webp: TbPhoto,
  bmp: TbPhoto
};

/**
 * Icon for a file node in tree/list views. For uploaded files, pass `fileName` to get an icon
 * matching the file format.
 */
export const getFileNodeIcon = (
  type: ContentNodeType,
  size = 13,
  fileName?: string | null
): React.ReactElement => {
  if (type === 'markdown') return <TbFileText size={size} />;
  const extension = type === 'file' ? fileName?.split('.').pop()?.toLowerCase() : undefined;
  const Icon = (extension && FILE_EXTENSION_ICONS[extension]) || TbFile;
  return <Icon size={size} />;
};

/** Human-readable label for rename / delete dialogs */
export const entityTypeLabel = (type: ContentNodeType): string =>
  type === 'folder'
    ? 'folder'
    : type === 'markdown'
      ? 'document'
      : type === 'file'
        ? 'file'
        : 'diagram';

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
    return (
      <>
        The document <b>{target.file.name}</b> will be permanently deleted.
      </>
    );
  if (target.type === 'file')
    return (
      <>
        The file <b>{target.file.original_filename ?? target.file.name}</b> will be permanently
        deleted.
      </>
    );
  return (
    <>
      The diagram <b>{target.file.name}</b> will be permanently deleted.
    </>
  );
};
