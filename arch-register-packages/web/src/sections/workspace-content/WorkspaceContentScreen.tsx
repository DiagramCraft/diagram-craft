import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText, TbFolderOpen, TbPlus, TbUpload } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { Title } from '../../components/Title';
import { useWorkspaceContentNodes, useCreateWorkspaceFolder, useCreateWorkspaceMarkdown, useUploadWorkspaceFile } from '../../hooks/useProjectFiles';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Button } from '@diagram-craft/app-components/Button';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import {
  DiagramBrowserToolbar,
  DiagramBrowserView
} from '../../components/diagram-browser/DiagramBrowserView';

type WorkspaceContentScreenProps = {
  workspaceSlug: string;
  folder: string;
};

export const WorkspaceContentScreen = ({ workspaceSlug, folder }: WorkspaceContentScreenProps) => {
  const navigate = useNavigate();
  const { workspace } = useWorkspaceContext();
  const { data } = useWorkspaceContentNodes(workspaceSlug);
  const createFolderMutation = useCreateWorkspaceFolder(workspaceSlug);
  const createMarkdownMutation = useCreateWorkspaceMarkdown(workspaceSlug);
  const uploadFileMutation = useUploadWorkspaceFile(workspaceSlug);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null);
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [addMarkdownOpen, setAddMarkdownOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);

  const handleDiagramClick = (fileId: string) => {
    navigate({
      to: '/$workspaceSlug/content/diagrams/$diagramId',
      params: { workspaceSlug, diagramId: fileId }
    });
  };

  const handleMarkdownClick = (fileId: string, mode: 'edit' | 'preview' = 'preview') => {
    navigate({
      to: '/$workspaceSlug/content/wiki/$nodeId',
      params: { workspaceSlug, nodeId: fileId },
      search: { mode }
    });
  };

  const handleDownloadClick = (path: string, name: string, originalFilename: string | null) => {
    const a = document.createElement('a');
    a.href = `/api/${workspaceSlug}/content/files/download?path=${encodeURIComponent(path)}`;
    a.download = originalFilename ?? name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      uploadFileMutation.mutate({ file: f, folder: folder || null });
    }
    e.target.value = '';
  };

  // If folder is set, show that folder's files; otherwise show root files
  const folderData = folder ? data?.folders.find(f => f.path === folder) : undefined;
  const files = folder
    ? (folderData?.files ?? [])
    : (data?.rootFiles ?? []);

  const lc = filter.toLowerCase();
  const filtered = lc ? files.filter(f => f.name.toLowerCase().includes(lc)) : files;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={[{ label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } }) }]}
          title={workspace?.name ?? workspaceSlug}
          buttons={
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setNewMenu({ x: rect.right, y: rect.bottom });
              }}
            >
              New
            </Button>
          }
        />
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <div className={styles.metaLabel}>Items</div>
          <div className={styles.metaValue}>
            <span className="mono tabular">{files.length}</span>
          </div>
        </div>
      </div>

      <DiagramBrowserToolbar
        filter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <DiagramBrowserView
        hasFilter={filter.length > 0}
        viewMode={viewMode}
        listItems={filtered.map(file => ({ file, folder }))}
        gridSections={[{ key: 'workspace-content', items: filtered, showAddButton: false }].map(section => ({
          ...section,
          items: section.items.map(file => ({ file }))
        }))}
        onOpenDiagram={file => handleDiagramClick(file.id)}
        onOpenMarkdown={file => handleMarkdownClick(file.id)}
        onDownloadFile={file => handleDownloadClick(file.path, file.name, file.original_filename ?? null)}
        emptyState={{ title: 'No content here', sub: 'Diagrams and documents will appear here when added.' }}
        noMatchState={{ title: 'No matches', sub: `No items match "${filter}".` }}
      />

      {newMenu && (
        <ContextMenu.Imperative x={newMenu.x} y={newMenu.y} align="right" onClose={() => setNewMenu(null)}>
          <Menu.Item
            leftSlot={<TbFolderOpen size={13} />}
            onClick={() => { setNewMenu(null); setAddFolderOpen(true); }}
          >
            New folder
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbUpload size={13} />}
            onClick={() => { setNewMenu(null); fileInputRef.current?.click(); }}
          >
            Upload file
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbPlus size={13} />}
            onClick={() => { setNewMenu(null); setAddDiagramOpen(true); }}
          >
            New diagram
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbFileText size={13} />}
            onClick={() => { setNewMenu(null); setAddMarkdownOpen(true); }}
          >
            New wiki page
          </Menu.Item>
        </ContextMenu.Imperative>
      )}

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <AddDiagramDialog
        open={addDiagramOpen}
        onClose={() => setAddDiagramOpen(false)}
        onCreated={file => {
          setAddDiagramOpen(false);
          handleDiagramClick(file.id);
        }}
        workspaceId={workspaceSlug}
        context="workspace"
        folder={folder || null}
      />

      <AddMarkdownDialog
        open={addMarkdownOpen}
        onClose={() => setAddMarkdownOpen(false)}
        onCreated={file => {
          setAddMarkdownOpen(false);
          handleMarkdownClick(file.id, 'edit');
        }}
        onCreate={name => createMarkdownMutation.mutateAsync({ name, folder: folder || null })}
        isPending={createMarkdownMutation.isPending}
      />

      <ContentFolderDialog
        open={addFolderOpen}
        onClose={() => setAddFolderOpen(false)}
        onCreated={() => setAddFolderOpen(false)}
        onSubmit={path => createFolderMutation.mutateAsync(path)}
        isPending={createFolderMutation.isPending}
        parentFolder={folder || undefined}
        placeholder="e.g. Architecture"
      />
    </div>
  );
};
