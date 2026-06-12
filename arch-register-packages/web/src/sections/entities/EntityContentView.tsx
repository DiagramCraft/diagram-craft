import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbLayoutGrid, TbList, TbPlus } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { useEntityContentNodes } from '../../hooks/useProjects';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import { DiagramCard, DiagramRow } from '../../components/DiagramCard';

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
      // Navigate to project diagram route
      navigate({
        to: '/$workspaceSlug/projects/$projectId/diagrams/$diagramId',
        params: {
          workspaceSlug,
          projectId,
          diagramId: fileId
        }
      });
    } else {
      // Navigate to entity diagram route
      navigate({
        to: '/$workspaceSlug/entities/$entityId/diagrams/$diagramId',
        params: {
          workspaceSlug,
          entityId,
          diagramId: fileId
        }
      });
    }
  };

  // Find the folder and its files
  const folderData = data?.folders.find(f => f.path === folder);
  const files = folderData?.files ?? [];
  const folderName = folderData?.name ?? folder;

  const lc = filter.toLowerCase();
  const filtered = lc ? files.filter(f => f.name.toLowerCase().includes(lc)) : files;

  if (filtered.length === 0 && !filter) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{folderName}</h1>
          </div>
        </div>
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No diagrams in this folder</div>
          <div className={styles.emptySub}>Diagrams will appear here when added to this folder.</div>
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{folderName}</h1>
          </div>
        </div>
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No matches</div>
          <div className={styles.emptySub}>No diagrams match "{filter}".</div>
        </div>
      </div>
    );
  }

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

      <div className={styles.tabBar}>
        <div className={styles.tabBarRight}>
          <TextInput
            variant="search"
            placeholder="Filter diagrams…"
            value={filter}
            onChange={v => setFilter(v ?? '')}
            onClear={() => setFilter('')}
          />
          <button
            type="button"
            className={`${styles.iconBtn} ${viewMode === 'grid' ? styles.iconBtnActive : ''}`}
            title="Grid view"
            onClick={() => setViewMode('grid')}
          >
            <TbLayoutGrid size={13} />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${viewMode === 'list' ? styles.iconBtnActive : ''}`}
            title="List view"
            onClick={() => setViewMode('list')}
          >
            <TbList size={13} />
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className={styles.diagramListPanel}>
          <div className={styles.diagramListHead}>
            <span>Name</span>
            <span>Folder</span>
            <span>Last edit</span>
          </div>
          {filtered.map(f => (
            <DiagramRow
              key={f.path}
              file={f}
              folder={folder}
              onOpen={() => handleDiagramClick(f.id, f.project_id)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.diagramGrid}>
          {filtered.map(f => (
            <DiagramCard
              key={f.path}
              file={f}
              onOpen={() => handleDiagramClick(f.id, f.project_id)}
            />
          ))}
          <button
            type="button"
            className={`${styles.diagramCard} ${styles.diagramCardAdd}`}
            onClick={() => setAddDiagramOpen(true)}
          >
            <TbPlus size={16} />
            New diagram
          </button>
        </div>
      )}

      <AddDiagramDialog
        open={addDiagramOpen}
        onClose={() => setAddDiagramOpen(false)}
        onCreated={file => {
          setAddDiagramOpen(false);
          handleDiagramClick(file.id, file.project_id);
        }}
        workspaceId={workspaceSlug}
        context="entity"
        entityId={entityId}
        folder={folder}
      />
    </div>
  );
};

