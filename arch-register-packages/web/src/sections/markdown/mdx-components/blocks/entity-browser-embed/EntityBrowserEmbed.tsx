import { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { asEntityPublicId, entityDetailRoute } from '../../../../../routes/publicObjectRoutes';
import { EntityBrowserView } from '../../../../entities/components/EntityBrowserView';
import {
  getFilterValue,
  isTreeBasedView,
  type BrowserEntityRecord
} from '../../../../entities/components/entityBrowserState';
import { useEntityBrowserData } from '../../../../entities/components/useEntityBrowserData';
import { decodeEntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';
import styles from './EntityBrowserEmbed.module.css';
import { EmptyState } from '../../../../../components/EmptyState';
import { buildEntityDisplayFields } from '../../../../entities/components/entityDisplayFields';

type Props = {
  config?: string;
};

export const EntityBrowserEmbed = ({ config: rawConfig }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, lifecycleStates, projects } = useWorkspaceContext();
  const { projectId } = useMdxContext();

  const config = useMemo(() => decodeEntityBrowserEmbedConfig(rawConfig), [rawConfig]);

  const isTreeBased = !!config && isTreeBasedView(config.view);

  const typeFilter = config ? getFilterValue(config.conditions, '_schemaId') : null;
  const ownerFilter = config ? getFilterValue(config.conditions, '_owner') : null;
  const statusFilter = config ? getFilterValue(config.conditions, '_lifecycle') : null;

  const schemaMap = useMemo(
    () => new Map(schemas.map((s, i) => [s.id, { schema: s, index: i }])),
    [schemas]
  );

  const onEntityClick = useCallback(
    (publicId: string) => navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(publicId))),
    [navigate, workspaceSlug]
  );

  const resolvedProjectId = projectId;
  const projectScope = resolvedProjectId ? (config?.projectScope ?? 'project') : 'all';
  const { filtered: rows, isLoading } = useEntityBrowserData({
    workspaceId: workspaceSlug,
    projectId: resolvedProjectId ?? undefined,
    projectScope,
    schemas,
    q: config?.q ?? '',
    conditions: config?.conditions ?? [],
    typeFilter,
    ownerFilter,
    statusFilter,
    sort: config?.sort ?? 'name',
    view: config?.view ?? 'table',
    pageIndex: 0,
    pageSize: 0,
    disablePaging: true,
    enabled: !!workspaceSlug && !!config && !isTreeBased
  });

  if (!config) {
    return (
      <div className={styles.container}>
        <EmptyState compact title="No view configured." />
      </div>
    );
  }

  if (isLoading && !isTreeBased) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  const viewConfig = config.viewConfigs[config.view] ?? null;
  const browserRows = rows as BrowserEntityRecord[];
  const displayFields = buildEntityDisplayFields(
    typeFilter ? schemas.filter(s => s.id === typeFilter) : schemas,
    !!resolvedProjectId
  );

  return (
    <EntityBrowserView
      view={config.view}
      rows={browserRows}
      schemaMap={schemaMap}
      schemas={schemas}
      lifecycleStates={lifecycleStates}
      projects={projects}
      workspaceId={workspaceSlug}
      projectId={resolvedProjectId ?? undefined}
      projectScope={projectScope}
      q={config.q}
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
