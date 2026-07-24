export type FolderTreeNode = {
  path: string;
  name: string;
  children: FolderTreeNode[];
};

export const buildFolderTree = (
  folders: ReadonlyArray<{ path: string; name?: string }>
): FolderTreeNode[] => {
  const roots: FolderTreeNode[] = [];
  const nodes = new Map<string, FolderTreeNode>();
  for (const folder of [...folders].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = folder.path.split('/');
    const node = {
      path: folder.path,
      name: folder.name ?? parts.at(-1) ?? folder.path,
      children: []
    };
    nodes.set(folder.path, node);
    const parent = nodes.get(parts.slice(0, -1).join('/'));
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
};
