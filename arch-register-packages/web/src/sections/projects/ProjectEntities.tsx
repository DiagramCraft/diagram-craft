import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCalendarEvent, TbPlus, TbLayoutList, TbCalendar } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData, ProjectEntity } from '@arch-register/api-types/projectContract';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '../../lib/api';
import { Chip } from '../../components/Chip';
import { TypeBadge } from '../../components/TypeBadge';
import styles from './ProjectDetailScreen.module.css';
import { ProjectMetaItem, ProjectScreenLayout } from './ProjectScreenLayout';
import { ProjectTimelineTab } from './ProjectTimelineTab';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { EntityBrowser } from '../entities/EntityBrowserScreen';

type ViewTab = 'entities' | 'future-changes' | 'timeline';
type GroupBy = 'entity' | 'date';

export const ProjectEntities = ({
  project,
  projectEntities,
  projectSnapshots,
  futureSnapshots,
  schemaMap,
  entityTypeColorMap,
  schemas,
  lifecycleStates,
  teams,
  onNavigateHome,
  onNavigateProject,
  onAddEntity,
  onToggleDone,
  onRemoveEntity,
  onPlanFutureChange,
  onApplySnapshot
}: {
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  projectSnapshots: EntitySnapshot[];
  futureSnapshots: EntitySnapshot[];
  schemaMap: Map<string, { color: string; icon: string | null }>;
  entityTypeColorMap: Map<string, string>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onAddEntity: () => void;
  onToggleDone: (entityId: string, isDone: boolean) => void;
  onRemoveEntity: (entityId: string) => void;
  onPlanFutureChange: (entityId: string) => void;
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('entities');
  const [groupBy, setGroupBy] = useState<GroupBy>('entity');

  const pendingCount = futureSnapshots.length;
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();

  return (
    <ProjectScreenLayout
      breadcrumbs={[
        { label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } }) },
        { label: 'Projects', onClick: onNavigateHome },
        { label: project.name, onClick: onNavigateProject }
      ]}
      title="Project Entities"
      meta={
        <>
          <ProjectMetaItem
            label="Number of entities"
            value={<span className="mono tabular">{projectEntities.length}</span>}
          />
          <ProjectMetaItem label="Owner" value={project.owner?.name ?? '—'} />
          <ProjectMetaItem label="Last edit" value={new Date(project.updated_at).toLocaleDateString()} />
        </>
      }
      toolbar={
        <div className={styles.tabBar}>
          <div className={styles.entityTabNav}>
            <button
              type="button"
              className={`${styles.entityTabBtn} ${activeTab === 'entities' ? styles.entityTabBtnActive : ''}`}
              onClick={() => setActiveTab('entities')}
            >
              Entities ({projectEntities.length})
            </button>
            <button
              type="button"
              className={`${styles.entityTabBtn} ${activeTab === 'future-changes' ? styles.entityTabBtnActive : ''}`}
              onClick={() => setActiveTab('future-changes')}
            >
              Future changes{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
            <button
              type="button"
              className={`${styles.entityTabBtn} ${activeTab === 'timeline' ? styles.entityTabBtnActive : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
          </div>
          {activeTab === 'entities' && project.canEdit && (
            <div className={styles.tabBarRight}>
              <Button icon={<TbPlus size={12} />} onClick={onAddEntity}>
                Add entity
              </Button>
            </div>
          )}
          {activeTab === 'future-changes' && pendingCount > 0 && (
            <div className={styles.tabBarRight}>
              <button
                type="button"
                className={`${styles.groupByBtn} ${groupBy === 'entity' ? styles.groupByBtnActive : ''}`}
                onClick={() => setGroupBy('entity')}
                title="Group by entity"
              >
                <TbLayoutList size={14} />
              </button>
              <button
                type="button"
                className={`${styles.groupByBtn} ${groupBy === 'date' ? styles.groupByBtnActive : ''}`}
                onClick={() => setGroupBy('date')}
                title="Group by date"
              >
                <TbCalendar size={14} />
              </button>
            </div>
          )}
        </div>
      }
    >
      {activeTab === 'entities' ? (
        <div className={`${styles.entityTab} ${styles.entityTabFill}`}>
          <EntityBrowser
            projectContext={{
              project: { id: project.id, canEdit: project.canEdit },
              projectEntities,
              entityTypeColorMap,
              onToggleDone,
              onRemoveEntity,
              onPlanFutureChange
            }}
          />
        </div>
      ) : activeTab === 'future-changes' ? (
        <FutureChangesTab
          project={project}
          futureSnapshots={futureSnapshots}
          projectEntities={projectEntities}
          schemaMap={schemaMap}
          groupBy={groupBy}
          onApplySnapshot={onApplySnapshot}
        />
      ) : (
        <div className={`${styles.entityTab} ${styles.entityTabFill}`}>
          <ProjectTimelineTab
            project={project}
            projectEntities={projectEntities}
            projectSnapshots={projectSnapshots}
            schemaMap={schemaMap}
            entityTypeColorMap={entityTypeColorMap}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            teams={teams}
            canEdit={project.canEdit}
            onApplySnapshot={onApplySnapshot}
          />
        </div>
      )}
    </ProjectScreenLayout>
  );
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
};

const FutureChangesTab = ({
  project,
  futureSnapshots,
  projectEntities,
  schemaMap,
  groupBy,
  onApplySnapshot
}: {
  project: ProjectDetailData;
  futureSnapshots: EntitySnapshot[];
  projectEntities: ProjectEntity[];
  schemaMap: Map<string, { color: string; icon: string | null }>;
  groupBy: GroupBy;
  onApplySnapshot: (snapshot: EntitySnapshot) => void;
}) => {
  if (futureSnapshots.length === 0) {
    return (
      <div className={styles.entityTab}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <TbCalendarEvent size={22} />
          </div>
          <div className={styles.emptyTitle}>No future changes planned</div>
          <div className={styles.emptySub}>
            Use the entity menu to plan future changes for entities in this project.
          </div>
        </div>
      </div>
    );
  }

  const entityMap = new Map(projectEntities.map(e => [e.entity_id, e]));

  if (groupBy === 'entity') {
    // Group by entity_id
    const groups = new Map<string, EntitySnapshot[]>();
    for (const snap of futureSnapshots) {
      const list = groups.get(snap.entity_id);
      if (list) list.push(snap);
      else groups.set(snap.entity_id, [snap]);
    }

    return (
      <div className={styles.entityTab}>
        <div className={styles.futureChangesGroups}>
          {[...groups.entries()].map(([entityId, snaps]) => {
            const pe = entityMap.get(entityId);
            const schema = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
            return (
              <div key={entityId} className={styles.futureGroup}>
                <div className={styles.futureGroupHead}>
                  {schema && <TypeBadge color={schema.color} icon={schema.icon} size={16} />}
                  <span className={styles.futureGroupName}>{pe?.entity_name ?? entityId}</span>
                  {pe?.entity_schema && (
                    <Chip tone="ghost">{pe.entity_schema.name}</Chip>
                  )}
                </div>
                {snaps.map(snap => (
                  <FutureSnapshotRow
                    key={snap.id}
                    snap={snap}
                    showEntity={false}
                    canEdit={project.canEdit}
                    onApply={onApplySnapshot}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Group by date
  const groups = new Map<string, EntitySnapshot[]>();
  for (const snap of futureSnapshots) {
    const key = snap.target_date ?? '__no-date__';
    const list = groups.get(key);
    if (list) list.push(snap);
    else groups.set(key, [snap]);
  }

  // Sort: dated groups first (ascending), then no-date
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === '__no-date__') return 1;
    if (b === '__no-date__') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className={styles.entityTab}>
      <div className={styles.futureChangesGroups}>
        {sortedKeys.map(key => {
          const snaps = groups.get(key)!;
          const label = key === '__no-date__' ? 'No target date' : formatDate(key) ?? key;
          return (
            <div key={key} className={styles.futureGroup}>
              <div className={styles.futureGroupHead}>
                <span className={styles.futureGroupName}>{label}</span>
              </div>
              {snaps.map(snap => (
                <FutureSnapshotRow
                  key={snap.id}
                  snap={snap}
                  showEntity={true}
                  entityName={entityMap.get(snap.entity_id)?.entity_name}
                  entitySchema={
                    entityMap.get(snap.entity_id)?.entity_schema
                      ? schemaMap.get(entityMap.get(snap.entity_id)!.entity_schema!.id)
                      : undefined
                  }
                  canEdit={project.canEdit}
                  onApply={onApplySnapshot}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FutureSnapshotRow = ({
  snap,
  showEntity,
  entityName,
  entitySchema,
  canEdit,
  onApply
}: {
  snap: EntitySnapshot;
  showEntity: boolean;
  entityName?: string;
  entitySchema?: { color: string; icon: string | null };
  canEdit: boolean;
  onApply: (snapshot: EntitySnapshot) => void;
}) => (
  <div className={styles.futureRow}>
    {showEntity && (
      <div className={styles.futureRowEntity}>
        {entitySchema && <TypeBadge color={entitySchema.color} icon={entitySchema.icon} size={14} />}
        <span>{entityName ?? snap.entity_id}</span>
      </div>
    )}
    <div className={styles.futureRowBody}>
      <div className={styles.futureRowMeta}>
        {snap.target_date && (
          <span className={styles.futureRowDate}>{formatDate(snap.target_date)}</span>
        )}
        {snap.commit_message && (
          <span className={styles.futureRowNote}>{snap.commit_message}</span>
        )}
      </div>
      {canEdit && (
        <button
          type="button"
          className={styles.futureRowApply}
          onClick={() => onApply(snap)}
        >
          Apply
        </button>
      )}
    </div>
  </div>
);
