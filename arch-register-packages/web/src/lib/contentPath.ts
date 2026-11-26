import type { ProjectFile } from '@arch-register/api-types/projectContentContract';

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

/** The path a new markdown document called `name` gets in `folder` (null for the root). */
export const markdownDocumentPath = (name: string, folder: string | null): string =>
  folder ? `${folder}/${name}.md` : `${name}.md`;

/** True when a file already exists at `path` in the content tree. */
export const isContentPathTaken = (
  tree: {
    rootFiles: Pick<ProjectFile, 'path'>[];
    folders: { files: Pick<ProjectFile, 'path'>[] }[];
  },
  path: string
): boolean =>
  tree.rootFiles.some(file => file.path === path) ||
  tree.folders.some(folder => folder.files.some(file => file.path === path));

/**
 * Resolves a relative markdown link (`./page`, `../other/page`) found in the file at
 * `fromFilePath` to a content path. Returns null for anything that is not a relative path inside
 * the content tree (absolute paths, URLs with a scheme, in-page anchors, links above the root).
 */
export const resolveRelativeContentPath = (fromFilePath: string, href: string): string | null => {
  const target = href.split(/[?#]/)[0] ?? '';
  if (!target || target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) return null;

  let decoded = target;
  try {
    decoded = decodeURI(target);
  } catch {
    // Keep the raw target when it is not valid percent-encoding
  }

  const segments = (parentPath(fromFilePath) ?? '').split('/').filter(Boolean);
  for (const segment of decoded.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.length > 0 ? segments.join('/') : null;
};

/** Finds the markdown file at `path`, with or without the `.md` extension. */
export const findMarkdownFileByPath = (
  tree: { rootFiles: ProjectFile[]; folders: { files: ProjectFile[] }[] },
  path: string
): ProjectFile | undefined => {
  const withoutExtension = path.replace(/\.md$/, '');
  return [...tree.rootFiles, ...tree.folders.flatMap(folder => folder.files)].find(
    file =>
      file.type === 'markdown' &&
      (file.path === withoutExtension || file.path === `${withoutExtension}.md`)
  );
};
