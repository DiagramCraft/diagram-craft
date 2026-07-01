import { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
import {
  getFilterValue,
  type BrowserEntityRecord
} from '../../../../entities/components/entityBrowserState';
import { useEntityBrowserData } from '../../../../entities/components/useEntityBrowserData';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { decodeEntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';
import styles from './EntityBrowserEmbed.module.css';

const noop = () => {};

type Props = {
  config?: string;
};

export const EntityBrowserEmbed = ({ config: rawConfig }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, lifecycleStates, projects } = useWorkspaceContext();
  const { projectId } = useMdxContext();

  const config = useMemo(() => decodeEntityBrowserEmbedConfig(rawConfig), [rawConfig]);

  const isTreeBased = config?.view === 'tree' || config?.view === 'hierarchy';

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
        <p className={styles.empty}>No view configured.</p>
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

  switch (config.view) {
    case 'table':
      return (
        <TableView
          rows={browserRows}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          onDelete={noop as (entity: EntityRecord) => void}
          onClone={noop as (entity: EntityRecord) => void}
          lifecycleStates={lifecycleStates}
          readOnly
        />
      );
    case 'cards':
      return (
        <CardsView
          rows={browserRows}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          onDelete={noop as (entity: EntityRecord) => void}
          onClone={noop as (entity: EntityRecord) => void}
          lifecycleStates={lifecycleStates}
          readOnly
        />
      );
    case 'tree':
      return (
        <TreeView
          workspaceId={workspaceSlug}
          projectId={resolvedProjectId ?? undefined}
          projectScope={projectScope}
          q={config.q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          onDelete={noop as (entity: EntityRecord) => void}
          onClone={noop as (entity: EntityRecord) => void}
          lifecycleStates={lifecycleStates}
          readOnly
        />
      );
    case 'radar':
      return (
        <RadarView
          rows={browserRows}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
          hideToolbar
        />
      );
    case 'timeline':
      return (
        <TimelineView
          rows={browserRows}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
          workspaceId={workspaceSlug}
          projects={projects}
          hideToolbar
        />
      );
    case 'matrix':
      return (
        <MatrixView
          rows={browserRows}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
          hideToolbar
        />
      );
    case 'hierarchy':
      return (
        <HierarchyView
          workspaceId={workspaceSlug}
          projectId={resolvedProjectId ?? undefined}
          projectScope={projectScope}
          q={config.q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
          hideToolbar
        />
      );
    case 'explore':
      return (
        <ExploreView
          rows={browserRows}
          onEntityClick={onEntityClick}
          config={viewConfig}
          onConfigChange={noop}
          hideToolbar
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
