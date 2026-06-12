import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFile, TbLayoutGrid, TbList, TbPlus } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { useEntityContentNodes } from '../../hooks/useProjects';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { AddEntityDiagramDialog } from './AddEntityDiagramDialog';
import type { ProjectFile } from '@arch-register/api-types/projectContract';

type EntityContentViewProps = {
  workspaceSlug: string;
  entityId: string;
  folder: string;
};

type FileEntry = ProjectFile;

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

      <AddEntityDiagramDialog
        open={addDiagramOpen}
        onClose={() => setAddDiagramOpen(false)}
        onCreated={(file) => {
          setAddDiagramOpen(false);
          // Navigate to the new diagram (use entityId as fallback for entity diagrams)
          handleDiagramClick(file.id, file.project_id);
        }}
        workspaceId={workspaceSlug}
        entityId={entityId}
        folder={folder}
      />
    </div>
  );
};

const DiagramCard = ({ file, onOpen }: { file: FileEntry; onOpen: () => void }) => {
  return (
    <button
      type="button"
      className={styles.diagramCard}
      onClick={onOpen}
    >
      <div className={styles.diagramThumb}>
        <div className={styles.diagramThumbGrid} />
        <div className={styles.diagramThumbNodes}>
          {file.preview_svg ? (
            <div dangerouslySetInnerHTML={{ __html: file.preview_svg }} />
          ) : (
            <svg viewBox="0 0 140 80" preserveAspectRatio="none">
              <rect
                x="10"
                y="14"
                width="32"
                height="18"
                rx="2"
                fill="var(--cmp-bg)"
                stroke="var(--base-fg-more-dim)"
              />
              <rect
                x="56"
                y="6"
                width="32"
                height="18"
                rx="2"
                fill="var(--cmp-bg)"
                stroke="var(--base-fg-more-dim)"
              />
              <rect
                x="56"
                y="44"
                width="32"
                height="18"
                rx="2"
                fill="var(--cmp-bg)"
                stroke="var(--base-fg-more-dim)"
              />
              <rect
                x="102"
                y="26"
                width="32"
                height="18"
                rx="2"
                fill="color-mix(in oklch, var(--tag-component) 28%, var(--cmp-bg))"
                stroke="var(--tag-component)"
              />
              <path
                d="M42 23 L56 15 M42 32 L56 53 M88 15 L102 35 M88 53 L102 35"
                stroke="var(--cmp-fg-disabled)"
                fill="none"
              />
            </svg>
          )}
        </div>
      </div>
      <div className={styles.diagramMeta}>
        <div className={styles.diagramName}>{file.name}</div>
      </div>
    </button>
  );
};

const DiagramRow = ({
  file,
  folder,
  onOpen
}: {
  file: FileEntry;
  folder?: string;
  onOpen: () => void;
}) => {
  return (
    <button
      type="button"
      className={styles.diagramListRow}
      onClick={onOpen}
    >
      <span className={styles.diagramListName}>
        <TbFile size={13} />
        {file.name}
      </span>
      <span className={styles.diagramListFolder}>{folder ?? '—'}</span>
      <span className={styles.diagramListDate}>
        {new Date(file.updated_at).toLocaleDateString()}
      </span>
    </button>
  );
};