import { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEntities } from '../../../../../hooks/useEntities';
import { useSavedViews } from '../../../../../hooks/useSavedViews';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { asEntityPublicId, entityDetailRoute } from '../../../../../routes/publicObjectRoutes';
import { EntityBrowserView } from '../../../../entities/components/EntityBrowserView';
import {
  getSavedViewConfig,
  isTreeBasedView,
  toSavedViewSearch,
  type BrowserEntityRecord
} from '../../../../entities/components/entityBrowserState';
import styles from './EntityViewEmbed.module.css';
import { Banner } from '../../../../../components/Banner';
import { EmptyState } from '../../../../../components/EmptyState';
import { buildEntityDisplayFields } from '../../../../entities/components/entityDisplayFields';

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

  const isTreeBased = !!savedView && isTreeBasedView(savedView.viewMode);

  const filters = savedView?.filters;
  const savedViewSearch = savedView ? toSavedViewSearch(savedView) : {};
  const resolvedProjectId = savedView?.projectId ?? projectId;
  const projectScope = savedView?.projectScope ?? 'all';
  const entityQuery =
    filters == null
      ? undefined
      : {
          ...filters,
          ...(resolvedProjectId ? { projectId: resolvedProjectId, projectScope } : {})
        };
  const { data: entities = [], isLoading: entitiesLoading } = useEntities(
    workspaceSlug,
    {
      entityQuery,
      view: 'full',
      limit: 100
    },
    { enabled: !!workspaceSlug && !!savedView && !isTreeBased }
  );

  const schemaMap = useMemo(
    () => new Map(schemas.map((s, i) => [s.id, { schema: s, index: i }])),
    [schemas]
  );

  const onEntityClick = useCallback(
    (publicId: string) => navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(publicId))),
    [navigate, workspaceSlug]
  );

  const isLoading = viewsLoading || (!isTreeBased && entitiesLoading);

  if (!viewId) {
    return (
      <div className={styles.container}>
        <EmptyState compact title="No view configured." />
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

  if (!savedView) {
    return (
      <div className={styles.container}>
        <Banner variant="error">Saved view not found or was deleted.</Banner>
      </div>
    );
  }

  const rows = entities as BrowserEntityRecord[];
  const viewConfig = getSavedViewConfig(savedView);
  const typeFilter = savedView.filters.schemaId ?? null;
  const ownerFilter = savedViewSearch.owner ?? null;
  const statusFilter = savedViewSearch.status ?? null;
  const q = savedViewSearch.q ?? '';
  const displayFields = buildEntityDisplayFields(
    typeFilter ? schemas.filter(s => s.id === typeFilter) : schemas,
    !!resolvedProjectId,
    null,
    savedView.filters.projections ?? []
  );

  return (
    <EntityBrowserView
      view={savedView.viewMode}
      rows={rows}
      schemaMap={schemaMap}
      schemas={schemas}
      lifecycleStates={lifecycleStates}
      projects={projects}
      workspaceId={workspaceSlug}
      projectId={resolvedProjectId ?? undefined}
      projectScope={projectScope}
      q={q}
      typeFilter={typeFilter}
      ownerFilter={ownerFilter}
      statusFilter={statusFilter}
      activeViewConfig={viewConfig}
      displayFields={displayFields}
      mode={{ kind: 'published', onEntityClick }}
      unsupportedView={
        <div className={styles.container}>
          <EmptyState compact title="Unsupported view mode." />
        </div>
      }
    />
  );
};
