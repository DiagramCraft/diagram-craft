import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbPlus } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { useEntityContentNodes } from '../../hooks/useProjects';
import { Button } from '@diagram-craft/app-components/Button';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import {
  DiagramBrowserToolbar,
  DiagramBrowserView
} from '../../components/diagram-browser/DiagramBrowserView';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDiagramRoute,
  projectDiagramRoute
} from '../../routes/publicObjectRoutes';

type EntityContentViewProps = {
  workspaceSlug: string;
  entityId: string;
  folder: string;
};

export const EntityContentView = ({ workspaceSlug, entityId, folder }: EntityContentViewProps) => {
  const navigate = useNavigate();
  const { data } = useEntityContentNodes(workspaceSlug, entityId);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);

  const handleDiagramClick = (fileId: string, projectId: string | null) => {
    if (projectId) {
      navigate(projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), fileId));
    } else {
      navigate(entityDiagramRoute(workspaceSlug, asEntityPublicId(entityId), fileId));
    }
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
        <div>
          <h1 className={styles.title}>{folderName}</h1>
        </div>
        <div className={styles.actions}>
          <Button
            variant="primary"
            icon={<TbPlus size={12} />}
            onClick={() => setAddDiagramOpen(true)}
          >
            New diagram
          </Button>
        </div>
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
        gridSections={[
          {
            key: 'entity-content',
            items: filtered.map(file => ({ file })),
            showAddButton: true
          }
        ]}
        onOpenDiagram={file => handleDiagramClick(file.id, file.project_public_id ?? file.project_id)}
        onNewDiagram={() => setAddDiagramOpen(true)}
        emptyState={{
          title: 'No diagrams in this folder',
          sub: 'Diagrams will appear here when added to this folder.'
        }}
        noMatchState={{ title: 'No matches', sub: `No diagrams match "${filter}".` }}
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
    </div>
  );
};
