import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText, TbFolderOpen, TbPlus, TbUpload } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { useEntityContentNodes } from '../../hooks/useProjects';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../components/Title';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { AddEntityFolderDialog } from './AddEntityFolderDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import {
  DiagramBrowserToolbar,
  DiagramBrowserView
} from '../../components/diagram-browser/DiagramBrowserView';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDiagramRoute,
  entityMarkdownRoute,
  projectDiagramRoute
} from '../../routes/publicObjectRoutes';
import { useUploadEntityFile, useCreateEntityMarkdown } from '../../hooks/useProjectFiles';

type EntityContentViewProps = {
  workspaceSlug: string;
  entityId: string;
  folder: string;
};

export const EntityContentView = ({ workspaceSlug, entityId, folder }: EntityContentViewProps) => {
  const navigate = useNavigate();
  const { data } = useEntityContentNodes(workspaceSlug, entityId);
  const uploadFileMutation = useUploadEntityFile(workspaceSlug, entityId);
  const createMarkdownMutation = useCreateEntityMarkdown(workspaceSlug, entityId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null);
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [addMarkdownOpen, setAddMarkdownOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);

  const handleDiagramClick = (fileId: string, projectId: string | null) => {
    if (projectId) {
      navigate(projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), fileId));
    } else {
      navigate(entityDiagramRoute(workspaceSlug, asEntityPublicId(entityId), fileId));
    }
  };

  const handleMarkdownClick = (fileId: string, mode: 'edit' | 'preview' = 'preview') => {
    navigate(entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), fileId, { mode }));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      uploadFileMutation.mutate({ file: f, folder });
    }
    e.target.value = '';
  };

  // Find the folder and its files
  const folderData = data?.folders.find(f => f.path === folder);
  const files = folderData?.files ?? [];
  const folderName = folderData?.name ?? folder;

  const lc = filter.toLowerCase();
  const filtered = lc ? files.filter(f => f.name.toLowerCase().includes(lc)) : files;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          title={folderName}
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
        gridSections={[
          {
            key: 'entity-content',
            items: filtered.map(file => ({ file })),
            showAddButton: false
          }
        ]}
        onOpenDiagram={file => handleDiagramClick(file.id, file.project_public_id ?? file.project_id)}
        onOpenMarkdown={file => handleMarkdownClick(file.id)}
        emptyState={{
          title: 'No content in this folder',
          sub: 'Diagrams and documents will appear here when added to this folder.'
        }}
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
          handleDiagramClick(file.id, file.project_public_id ?? file.project_id);
        }}
        workspaceId={workspaceSlug}
        context="entity"
        entityId={entityId}
        folder={folder}
      />

      <AddMarkdownDialog
        open={addMarkdownOpen}
        onClose={() => setAddMarkdownOpen(false)}
        onCreated={file => {
          setAddMarkdownOpen(false);
          handleMarkdownClick(file.id, 'edit');
        }}
        onCreate={name => createMarkdownMutation.mutateAsync({ name, folder })}
        isPending={createMarkdownMutation.isPending}
      />

      <AddEntityFolderDialog
        open={addFolderOpen}
        onClose={() => setAddFolderOpen(false)}
        onCreated={() => setAddFolderOpen(false)}
        workspaceSlug={workspaceSlug}
        entityId={entityId}
        parentFolder={folder}
      />
    </div>
  );
};
