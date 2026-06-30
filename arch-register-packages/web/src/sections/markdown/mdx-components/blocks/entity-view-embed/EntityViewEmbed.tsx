import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEntities, useSavedViews } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { asEntityPublicId, entityDetailRoute } from '../../../../../routes/publicObjectRoutes';
import { TableView } from '../../../../entities/components/TableView';
import { CardsView } from '../../../../entities/components/CardsView';
import { TreeView } from '../../../../entities/components/TreeView';
import { RadarView } from '../../../../entities/components/RadarView';
import { TimelineView } from '../../../../entities/components/TimelineView';
import { MatrixView } from '../../../../entities/components/MatrixView';
import { HierarchyView } from '../../../../entities/components/HierarchyView';
import { ExploreView } from '../../../../entities/components/ExploreView';
import type { BrowserEntityRecord } from '../../../../entities/components/entityBrowserState';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import styles from './EntityViewEmbed.module.css';

const noop = () => {};
const emptySet = new Set<string>();

const getViewConfig = (savedView: { viewMode: string; config: { radar?: unknown; timeline?: unknown; matrix?: unknown; hierarchy?: unknown; explore?: unknown } | null }): unknown => {
  if (!savedView.config) return null;
  if (savedView.viewMode === 'radar') return savedView.config.radar ?? null;
  if (savedView.viewMode === 'timeline') return savedView.config.timeline ?? null;
  if (savedView.viewMode === 'matrix') return savedView.config.matrix ?? null;
  if (savedView.viewMode === 'hierarchy') return savedView.config.hierarchy ?? null;
  if (savedView.viewMode === 'explore') return savedView.config.explore ?? null;
  return null;
};

type Props = {
  viewId?: string;
};

export const EntityViewEmbed = ({ viewId }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, lifecycleStates, projects } = useWorkspaceContext();
  const { projectId } = useMdxContext();

  const { data: savedViews = [], isLoading: viewsLoading } = useSavedViews(
    workspaceSlug,
    projectId ? { projectId, includeWorkspace: true } : undefined
  );

  const savedView = viewId ? savedViews.find(v => v.id === viewId) : undefined;

  const isTreeBased = savedView?.viewMode === 'tree' || savedView?.viewMode === 'hierarchy';

  const filters = savedView?.filters;
  const { data: entities = [], isLoading: entitiesLoading } = useEntities(
    workspaceSlug,
    {
      schemaId: filters?.schemaId ?? undefined,
      owner: filters?.owner ?? undefined,
      lifecycle: filters?.status ?? undefined,
      q: filters?.q ?? undefined,
      conditions: filters?.conditions ?? undefined,
      view: 'full',
      limit: 100
    },
    { enabled: !!workspaceSlug && !!savedView && !isTreeBased }
  );

  const schemaMap = useMemo(
    () => new Map(schemas.map((s, i) => [s.id, { schema: s, index: i }])),
    [schemas]
  );

  const onEntityClick = (publicId: string) =>
    navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(publicId)));

  const isLoading = viewsLoading || (!isTreeBased && entitiesLoading);

  if (!viewId) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>No view configured.</p>
      </div>
    );
  }

  if (viewsLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (!savedView) {
    return (
      <div className={styles.container}>
        <p className={styles.error}>Saved view not found or was deleted.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  const rows = entities as BrowserEntityRecord[];
  const viewConfig = getViewConfig(savedView);
  const typeFilter = savedView.filters.schemaId ?? null;
  const ownerFilter = savedView.filters.owner ?? null;
  const statusFilter = savedView.filters.status ?? null;
  const q = savedView.filters.q ?? '';
  const resolvedProjectId = savedView.projectId ?? projectId;
  const projectScope = savedView.projectScope ?? 'all';

  switch (savedView.viewMode) {
    case 'table':
      return (
        <TableView
          rows={rows}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          onDelete={noop as (entity: EntityRecord) => void}
          onClone={noop as (entity: EntityRecord) => void}
          lifecycleStates={lifecycleStates}
          selectedIds={emptySet}
          onSelectAll={noop}
          onSelectRow={noop}
        />
      );
    case 'cards':
      return (
        <CardsView
          rows={rows}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          onDelete={noop as (entity: EntityRecord) => void}
          onClone={noop as (entity: EntityRecord) => void}
          lifecycleStates={lifecycleStates}
        />
      );
    case 'tree':
      return (
        <TreeView
          workspaceId={workspaceSlug}
          projectId={resolvedProjectId ?? undefined}
          projectScope={projectScope}
          q={q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          onDelete={noop as (entity: EntityRecord) => void}
          onClone={noop as (entity: EntityRecord) => void}
          lifecycleStates={lifecycleStates}
        />
      );
    case 'radar':
      return (
        <RadarView
          rows={entities}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
        />
      );
    case 'timeline':
      return (
        <TimelineView
          rows={entities}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
          workspaceId={workspaceSlug}
          projects={projects}
        />
      );
    case 'matrix':
      return (
        <MatrixView
          rows={entities}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
        />
      );
    case 'hierarchy':
      return (
        <HierarchyView
          workspaceId={workspaceSlug}
          projectId={resolvedProjectId ?? undefined}
          projectScope={projectScope}
          q={q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
        />
      );
    case 'explore':
      return (
        <ExploreView
          rows={entities}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
        />
      );
    default:
      return (
        <div className={styles.container}>
          <p className={styles.empty}>Unsupported view mode.</p>
        </div>
      );
  }
};
