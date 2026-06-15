import { useState } from 'react';
import { TbFile, TbFileText, TbFolder, TbHome, TbPlus } from 'react-icons/tb';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import { useWorkspaceContentNodes, useCreateWorkspaceFolder } from '../../hooks/useProjectFiles';
import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';

export const WorkspaceContentSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const { data } = useWorkspaceContentNodes(workspaceSlug);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const createFolderMutation = useCreateWorkspaceFolder(workspaceSlug);
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { diagramId?: string; nodeId?: string };
  const search = useSearch({ strict: false }) as { contentFolder?: string };
  const contentFolder = search.contentFolder;
  const activeFileId = params.nodeId ?? params.diagramId ?? null;
  const isFileRoute = activeFileId !== null;

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  type FolderNode = {
    path: string;
    name: string;
    files: Array<{ id: string; name: string; path: string; project_id: string | null; type: 'diagram' | 'folder' | 'markdown' | 'file' }>;
    children: FolderNode[];
  };

  const buildFolderTree = (
    folders: Array<{
      path: string;
      name: string;
      files: Array<{ id: string; name: string; path: string; project_id: string | null; type: 'diagram' | 'folder' | 'markdown' | 'file' }>;
    }>
  ): FolderNode[] => {
    const root: FolderNode[] = [];
    const map = new Map<string, FolderNode>();
    const sorted = [...folders].sort((a, b) => a.path.localeCompare(b.path));
    for (const folder of sorted) {
      const parts = folder.path.split('/');
      const node: FolderNode = { path: folder.path, name: folder.name, files: folder.files, children: [] };
      map.set(folder.path, node);
      if (parts.length === 1) {
        root.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = map.get(parentPath);
        if (parent) {
          parent.children.push(node);
        } else {
          root.push(node);
        }
      }
    }
    return root;
  };

  const folderTree = data ? buildFolderTree(data.folders) : [];
  const activeFilePath = data
    ? [...data.rootFiles, ...data.folders.flatMap(folder => folder.files)].find(file => file.id === activeFileId)?.path ?? null
    : null;

  const renderFolderNode = (node: FolderNode, depth = 0): React.ReactNode => {
    const isExpanded =
      expandedFolders.has(node.path) ||
      activeFilePath?.startsWith(`${node.path}/`);
    return (
      <div key={node.path}>
        <TreeRow
          icon={<TbFolder size={13} />}
          label={node.name}
          expandable
          expanded={isExpanded}
          active={contentFolder === node.path}
          depth={depth}
          onExpand={() => toggleFolder(node.path)}
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/content',
              params: { workspaceSlug },
              search: { contentFolder: node.path }
            })
          }
        />
        {isExpanded && (
          <>
            {node.files.map(file => (
              <TreeRow
                key={file.id}
                depth={depth + 1}
                icon={file.type === 'markdown' ? <TbFileText size={13} /> : <TbFile size={13} />}
                label={file.name}
                active={file.id === activeFileId}
                onClick={() =>
                  navigate(
                    file.type === 'markdown'
                      ? {
                          to: '/$workspaceSlug/content/markdown/$nodeId',
                          params: { workspaceSlug, nodeId: file.id }
                        }
                      : {
                          to: '/$workspaceSlug/content/diagrams/$diagramId',
                          params: { workspaceSlug, diagramId: file.id }
                        }
                  )
                }
              />
            ))}
            {node.children.map(child => renderFolderNode(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root value="content" onValueChange={() => {}}>
          <Tabs.List>
            <Tabs.Trigger value="content">Content</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.action}
            onClick={() => setAddFolderOpen(true)}
            title="New folder"
          >
            <TbPlus size={13} />
          </button>
        </div>
      </div>
      <div className={styles.scroll}>
        <TreeRow
          label="Home"
          icon={<TbHome size={13} />}
          active={!contentFolder && !isFileRoute}
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/content',
              params: { workspaceSlug }
            })
          }
        />
        {data?.rootFiles.map(file => (
          <TreeRow
            key={file.id}
            icon={file.type === 'markdown' ? <TbFileText size={13} /> : <TbFile size={13} />}
            label={file.name}
            active={file.id === activeFileId}
            onClick={() =>
              navigate(
                file.type === 'markdown'
                  ? {
                      to: '/$workspaceSlug/content/markdown/$nodeId',
                      params: { workspaceSlug, nodeId: file.id }
                    }
                  : {
                      to: '/$workspaceSlug/content/diagrams/$diagramId',
                      params: { workspaceSlug, diagramId: file.id }
                    }
              )
            }
          />
        ))}
        {folderTree.map(node => renderFolderNode(node, 0))}
      </div>
      <ContentFolderDialog
        open={addFolderOpen}
        onClose={() => setAddFolderOpen(false)}
        onCreated={() => setAddFolderOpen(false)}
        onSubmit={path => createFolderMutation.mutateAsync(path)}
        isPending={createFolderMutation.isPending}
        parentFolder={contentFolder}
        placeholder="e.g. Architecture"
      />
    </>
  );
};
