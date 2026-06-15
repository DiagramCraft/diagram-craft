import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText, TbPlus } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { Title } from '../../components/Title';
import { useWorkspaceContentNodes, useCreateWorkspaceMarkdown } from '../../hooks/useProjectFiles';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Button } from '@diagram-craft/app-components/Button';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
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
  const createMarkdown = useCreateWorkspaceMarkdown(workspaceSlug);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [addMarkdownOpen, setAddMarkdownOpen] = useState(false);

  const handleDiagramClick = (fileId: string) => {
    navigate({
      to: '/$workspaceSlug/content/diagrams/$diagramId',
      params: { workspaceSlug, diagramId: fileId }
    });
  };

  const handleMarkdownClick = (fileId: string, mode: 'edit' | 'preview' = 'preview') => {
    navigate({
      to: '/$workspaceSlug/content/markdown/$nodeId',
      params: { workspaceSlug, nodeId: fileId },
      search: { mode }
    });
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" icon={<TbFileText size={12} />} onClick={() => setAddMarkdownOpen(true)}>
                New document
              </Button>
              <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setAddDiagramOpen(true)}>
                New diagram
              </Button>
            </div>
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
        gridSections={[{ key: 'workspace-content', items: filtered, showAddButton: true }].map(section => ({
          ...section,
          items: section.items.map(file => ({ file }))
        }))}
        onOpenDiagram={file => handleDiagramClick(file.id)}
        onOpenMarkdown={file => handleMarkdownClick(file.id)}
        onNewDiagram={() => setAddDiagramOpen(true)}
        emptyState={{ title: 'No content here', sub: 'Diagrams and documents will appear here when added.' }}
        noMatchState={{ title: 'No matches', sub: `No items match "${filter}".` }}
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
        onCreated={file => handleMarkdownClick(file.id, 'edit')}
        onCreate={name => createMarkdown.mutateAsync({ name, folder: folder || null })}
        isPending={createMarkdown.isPending}
      />
    </div>
  );
};
