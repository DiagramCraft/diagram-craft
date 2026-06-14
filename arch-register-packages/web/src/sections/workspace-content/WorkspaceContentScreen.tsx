import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbPlus } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { Title } from '../../components/Title';
import { useWorkspaceContentNodes } from '../../hooks/useProjectFiles';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Button } from '@diagram-craft/app-components/Button';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
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
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);

  const handleDiagramClick = (fileId: string) => {
    navigate({
      to: '/$workspaceSlug/content/diagrams/$diagramId',
      params: { workspaceSlug, diagramId: fileId }
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
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setAddDiagramOpen(true)}>
              New diagram
            </Button>
          }
        />
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <div className={styles.metaLabel}>Diagrams</div>
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
        onNewDiagram={() => setAddDiagramOpen(true)}
        emptyState={{ title: 'No diagrams here', sub: 'Diagrams will appear here when added.' }}
        noMatchState={{ title: 'No matches', sub: `No diagrams match "${filter}".` }}
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
    </div>
  );
};
