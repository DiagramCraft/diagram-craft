import type { ProjectFile } from '@arch-register/api-types/projectContract';

export type ContentFolder = {
  path: string;
  name: string;
  files: ProjectFile[];
  read_only?: boolean;
  mount_id?: string | null;
};

export type ContentFolderNode = ContentFolder & { children: ContentFolderNode[] };

export const parentPath = (path: string): string | null => {
  const index = path.lastIndexOf('/');
  return index < 0 ? null : path.slice(0, index);
};

export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export const movePath = (path: string, targetFolder: string | null): string =>
  targetFolder ? `${targetFolder}/${baseName(path)}` : baseName(path);

export const renamePath = (file: ProjectFile, newName: string): string => {
  const folder = parentPath(file.path);
  const name =
    file.type === 'file' ? newName : `${newName}${file.type === 'markdown' ? '.md' : '.json'}`;
  return folder ? `${folder}/${name}` : name;
};

export const buildContentFolderTree = (folders: ContentFolder[]): ContentFolderNode[] => {
  const roots: ContentFolderNode[] = [];
  const nodes = new Map<string, ContentFolderNode>();

  for (const folder of [...folders].sort((a, b) => a.path.localeCompare(b.path))) {
    const node = { ...folder, children: [] } satisfies ContentFolderNode;
    nodes.set(folder.path, node);
    const parent = parentPath(folder.path);
    const parentNode = parent ? nodes.get(parent) : undefined;
    if (parentNode) parentNode.children.push(node);
    else roots.push(node);
  }

  return roots;
};

export const findContentFilePath = (
  rootFiles: ProjectFile[],
  folders: ContentFolder[],
  fileId: string | null
): string | null =>
  fileId
    ? ([...rootFiles, ...folders.flatMap(folder => folder.files)].find(file => file.id === fileId)
        ?.path ?? null)
    : null;

export const findContentFile = (
  rootFiles: ProjectFile[],
  folders: ContentFolder[],
  fileId: string | null
): ProjectFile | undefined =>
  fileId
    ? [...rootFiles, ...folders.flatMap(folder => folder.files)].find(file => file.id === fileId)
    : undefined;
