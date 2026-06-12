import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbLayoutGrid, TbList, TbPlus } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { useWorkspaceContentNodes } from '../../hooks/useProjectFiles';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import { DiagramCard, DiagramRow } from '../../components/DiagramCard';

type WorkspaceContentScreenProps = {
  workspaceSlug: string;
  folder: string;
};

export const WorkspaceContentScreen = ({ workspaceSlug, folder }: WorkspaceContentScreenProps) => {
  const navigate = useNavigate();
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
  const title = folder
    ? (folderData?.name ?? folder)
    : 'Workspace content';

  const lc = filter.toLowerCase();
  const filtered = lc ? files.filter(f => f.name.toLowerCase().includes(lc)) : files;

  if (filtered.length === 0 && !filter) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
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
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No diagrams here</div>
          <div className={styles.emptySub}>Diagrams will appear here when added.</div>
        </div>
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
  }

  if (filtered.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
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
          <h1 className={styles.title}>{title}</h1>
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
              onOpen={() => handleDiagramClick(f.id)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.diagramGrid}>
          {filtered.map(f => (
            <DiagramCard
              key={f.path}
              file={f}
              onOpen={() => handleDiagramClick(f.id)}
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
          handleDiagramClick(file.id);
        }}
        workspaceId={workspaceSlug}
        context="workspace"
        folder={folder || null}
      />
    </div>
  );
};
