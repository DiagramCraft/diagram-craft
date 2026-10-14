import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Pagination } from '../../../../../components/Pagination';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { useEntityDrawer } from '../../../../entities/entityDrawer/useEntityDrawer';
import { EntityBrowserView } from '../../../../entities/components/EntityBrowserView';
import {
  getFilterValue,
  isTreeBasedView,
  stripEmptyGroups,
  type BrowserEntityRecord
} from '../../../../entities/components/entityBrowserState';
import { useEntityBrowserPagination } from '../../../../entities/components/useEntityBrowserPagination';
import { useEntityBrowserData } from '../../../../entities/components/useEntityBrowserData';
import { resolveMapOverlays } from '../../../../entities/components/mapOverlays';
import type { EntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';
import styles from './EntityBrowserEmbed.module.css';
import { EmptyState } from '../../../../../components/EmptyState';
import { buildEntityDisplayFields } from '../../../../entities/components/entityDisplayFields';
import {
  resolveEntityQuery,
  resolveMapViewConfig,
  resolveMatrixViewConfig,
  resolveSort,
  resolveTableFieldIds
} from './EntityBrowserEmbedFieldResolution';

type Props = {
  config: EntityBrowserEmbedConfig;
};

export const EntityBrowserEmbed = ({ config }: Props) => {
  const { openEntityDrawer } = useEntityDrawer();
  const { workspaceSlug, schemas, relationSchemas, lifecycleStates, projects } =
    useWorkspaceContext();
  const { projectId } = useMdxContext();

  const isTreeBased = isTreeBasedView(config.view);

  // `schemaName` (a seeded, cross-workspace config's only safe way to reference a schema — its
  // actual id is workspace-specific) resolves to an id here at render time, same as
  // `dashboardSidebarConfigSchema.schemaName` does; an explicit `_schemaId` condition still wins if
  // both are present.
  const schemaNameId = config.schemaName
    ? schemas.find(schema => schema.name === config.schemaName)?.id
    : undefined;
  const typeFilter = getFilterValue(config.conditions, '_schemaId') ?? schemaNameId ?? null;
  const ownerFilter = getFilterValue(config.conditions, '_owner');
  const statusFilter = getFilterValue(config.conditions, '_lifecycle');

  const schemaMap = useMemo(
    () => new Map(schemas.map((s, i) => [s.id, { schema: s, index: i }])),
    [schemas]
  );

  const onEntityClick = useCallback(
    (publicId: string) => openEntityDrawer(publicId),
    [openEntityDrawer]
  );

  // The root schema an `entityQuery`'s field NAMEs (see `EntityBrowserEmbedConfig`'s doc comment)
  // and `viewConfigs.table.fieldIds` resolve against — the same reason `schemaName` above isn't
  // used as a raw id directly.
  const rootSchema = typeFilter ? schemas.find(schema => schema.id === typeFilter) : undefined;
  const resolvedEntityQuery = useMemo(() => {
    if (!config.entityQuery) return null;
    // An unselected sidebar facet leaves an empty `in` (see `dashboardSidebarVariables.ts`), which
    // reads as "no filter" only once stripped; the table path strips it itself, the tree and map
    // fetch directly and need it done here.
    return stripEmptyGroups(
      resolveEntityQuery(config.entityQuery, rootSchema, typeFilter, {
        schemas,
        relationSchemas
      })
    );
  }, [config.entityQuery, rootSchema, typeFilter, schemas, relationSchemas]);

  // The configured sort is only the initial one; a column-header click re-sorts locally without
  // changing the saved config.
  const configuredSort = useMemo(
    () => resolveSort(config.sort, rootSchema),
    [config.sort, rootSchema]
  );
  const [sortOverride, setSortOverride] = useState<{ base: string; sort: string } | null>(null);
  const sort = sortOverride?.base === configuredSort ? sortOverride.sort : configuredSort;

  const resolvedActiveViewConfig = useMemo(
    () =>
      config.view === 'matrix'
        ? resolveMatrixViewConfig(config.viewConfigs.matrix, schemas, rootSchema)
        : config.view === 'map'
          ? resolveMapViewConfig(config.viewConfigs.map, schemas)
          : resolveTableFieldIds(config.viewConfigs[config.view], rootSchema),
    [config, rootSchema, schemas]
  );
  // `_usageCount` is opt-in server-side (not free per row) — request it only when a shown column
  // actually asks for it.
  const includeUsageCount =
    !!resolvedActiveViewConfig &&
    typeof resolvedActiveViewConfig === 'object' &&
    Array.isArray((resolvedActiveViewConfig as { fieldIds?: unknown }).fieldIds) &&
    (resolvedActiveViewConfig as { fieldIds: string[] }).fieldIds.includes('_usageCount');

  const mapOverlays = useMemo(
    () => (config.view === 'map' ? resolveMapOverlays(config.overlays, rootSchema) : undefined),
    [config.view, config.overlays, rootSchema]
  );

  const hasLoaded = useRef(false);
  const resolvedProjectId = projectId;
  const projectScope = resolvedProjectId ? (config.projectScope ?? 'project') : 'all';

  // Opt-in (config.interactive): a search box and real pagination for the row-based views.
  const interactive = !!config.interactive && (config.view === 'table' || config.view === 'cards');
  const [searchText, setSearchText] = useState(config.q);
  const q = interactive ? searchText : config.q;
  const serverPaged = interactive && sort === 'name';
  const {
    pageIndex,
    pageSize,
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    setPageIndex
  } = useEntityBrowserPagination({
    isPagedBrowse: interactive,
    q,
    conditions: config.conditions,
    entityQuery: resolvedEntityQuery,
    typeFilter,
    ownerFilter,
    statusFilter,
    projectId: resolvedProjectId ?? undefined,
    projectScope
  });
  // Sorting by anything but name fetches every row (the server only pages by name), so those are
  // paged client-side below; either way a re-sort starts again from the first page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sort is the intentional trigger
  useEffect(() => setPageIndex(0), [sort, setPageIndex]);
  const {
    filtered: rows,
    isLoading,
    filteredCount
  } = useEntityBrowserData({
    workspaceId: workspaceSlug,
    projectId: resolvedProjectId ?? undefined,
    projectScope,
    schemas,
    q,
    conditions: config.conditions,
    entityQuery: resolvedEntityQuery,
    typeFilter,
    ownerFilter,
    statusFilter,
    sort,
    view: config.view,
    pageIndex: interactive ? pageIndex : 0,
    pageSize: interactive ? pageSize : 0,
    disablePaging: !interactive,
    enabled: !!workspaceSlug && !isTreeBased,
    activeViewConfig: resolvedActiveViewConfig,
    includeUsageCount
  });

  if (!isLoading) hasLoaded.current = true;

  // In interactive mode the search box must survive reloads, so only the first load is a skeleton.
  if (isLoading && !isTreeBased && !(interactive && hasLoaded.current)) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  const viewConfig = resolvedActiveViewConfig ?? null;
  const allRows = rows as BrowserEntityRecord[];
  const fetchesOwnTree = config.view === 'map' || config.view === 'tree';
  const browserRows = interactive
    ? serverPaged
      ? allRows
      : allRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
    : config.limit
      ? allRows.slice(0, config.limit)
      : allRows;
  const canGoNext = serverPaged
    ? filteredCount >= pageSize
    : (pageIndex + 1) * pageSize < allRows.length;
  const displayFields = buildEntityDisplayFields(
    typeFilter ? schemas.filter(s => s.id === typeFilter) : schemas,
    !!resolvedProjectId,
    null,
    config.entityQuery?.projections ?? []
  );

  return (
    <div className={styles.entityBrowserWrapper}>
      {interactive && (
        <div className={styles.searchRow}>
          <TextInput
            value={searchText}
            onChange={value => setSearchText(value ?? '')}
            placeholder="Search…"
          />
        </div>
      )}
      <EntityBrowserView
        view={config.view}
        rows={browserRows}
        schemaMap={schemaMap}
        schemas={schemas}
        relationSchemas={relationSchemas}
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
        // The map and tree fetch their own (tree) data, so they need the resolved query and
        // conditions that the row-based views get through `useEntityBrowserData` above.
        conditions={fetchesOwnTree ? config.conditions : undefined}
        entityQuery={fetchesOwnTree ? resolvedEntityQuery : undefined}
        executionEntityQuery={fetchesOwnTree ? resolvedEntityQuery : undefined}
        mapOverlays={mapOverlays}
        mapDimOwnerIds={config.dimOwnerIds}
        sort={sort}
        onSortChange={next => setSortOverride({ base: configuredSort, sort: next })}
        displayFields={displayFields}
        isLoading={isLoading}
        mode={{ kind: 'published', onEntityClick }}
        unsupportedView={
          <div className={styles.container}>
            <EmptyState compact title="Unsupported view mode." />
          </div>
        }
      />
      {interactive && (
        <Pagination
          pageSize={pageSize}
          onPageSizeChange={size => handlePageSizeChange(String(size))}
          canGoPrev={pageIndex !== 0}
          canGoNext={canGoNext}
          onPrev={goToPreviousPage}
          onNext={goToNextPage}
        />
      )}
    </div>
  );
};
