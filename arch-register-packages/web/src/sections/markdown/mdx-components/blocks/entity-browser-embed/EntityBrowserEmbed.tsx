import { useCallback, useMemo } from 'react';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { useEntityDrawer } from '../../../../entities/entityDrawer/useEntityDrawer';
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
import { resolveEntityQuery, resolveTableFieldIds } from './EntityBrowserEmbedFieldResolution';

type Props = {
  config?: string;
};

export const EntityBrowserEmbed = ({ config: rawConfig }: Props) => {
  const { openEntityDrawer } = useEntityDrawer();
  const { workspaceSlug, schemas, relationSchemas, lifecycleStates, projects } =
    useWorkspaceContext();
  const { projectId } = useMdxContext();

  const config = useMemo(() => decodeEntityBrowserEmbedConfig(rawConfig), [rawConfig]);

  const isTreeBased = !!config && isTreeBasedView(config.view);

  // `schemaName` (a seeded, cross-workspace config's only safe way to reference a schema — its
  // actual id is workspace-specific) resolves to an id here at render time, same as
  // `dashboardSidebarConfigSchema.schemaName` does; an explicit `_schemaId` condition still wins if
  // both are present.
  const schemaNameId = config?.schemaName
    ? schemas.find(schema => schema.name === config.schemaName)?.id
    : undefined;
  const typeFilter = config
    ? (getFilterValue(config.conditions, '_schemaId') ?? schemaNameId ?? null)
    : null;
  const ownerFilter = config ? getFilterValue(config.conditions, '_owner') : null;
  const statusFilter = config ? getFilterValue(config.conditions, '_lifecycle') : null;

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
    if (!config?.entityQuery) return null;
    return resolveEntityQuery(config.entityQuery, rootSchema, typeFilter, {
      schemas,
      relationSchemas
    });
  }, [config?.entityQuery, rootSchema, typeFilter, schemas, relationSchemas]);

  const resolvedActiveViewConfig = useMemo(
    () => resolveTableFieldIds(config?.viewConfigs[config?.view ?? 'table'], rootSchema),
    [config, rootSchema]
  );
  // `_usageCount` is opt-in server-side (not free per row) — request it only when a shown column
  // actually asks for it.
  const includeUsageCount =
    !!resolvedActiveViewConfig &&
    typeof resolvedActiveViewConfig === 'object' &&
    Array.isArray((resolvedActiveViewConfig as { fieldIds?: unknown }).fieldIds) &&
    (resolvedActiveViewConfig as { fieldIds: string[] }).fieldIds.includes('_usageCount');

  const resolvedProjectId = projectId;
  const projectScope = resolvedProjectId ? (config?.projectScope ?? 'project') : 'all';
  const { filtered: rows, isLoading } = useEntityBrowserData({
    workspaceId: workspaceSlug,
    projectId: resolvedProjectId ?? undefined,
    projectScope,
    schemas,
    q: config?.q ?? '',
    conditions: config?.conditions ?? [],
    entityQuery: resolvedEntityQuery,
    typeFilter,
    ownerFilter,
    statusFilter,
    sort: config?.sort ?? 'name',
    view: config?.view ?? 'table',
    pageIndex: 0,
    pageSize: 0,
    disablePaging: true,
    enabled: !!workspaceSlug && !!config && !isTreeBased,
    activeViewConfig: resolvedActiveViewConfig,
    includeUsageCount
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

  const viewConfig = resolvedActiveViewConfig ?? null;
  const browserRows = rows as BrowserEntityRecord[];
  const displayFields = buildEntityDisplayFields(
    typeFilter ? schemas.filter(s => s.id === typeFilter) : schemas,
    !!resolvedProjectId,
    null,
    config.entityQuery?.projections ?? []
  );

  return (
    <div className={styles.entityBrowserWrapper}>
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
        displayFields={displayFields}
        isLoading={isLoading}
        mode={{ kind: 'published', onEntityClick }}
        unsupportedView={
          <div className={styles.container}>
            <EmptyState compact title="Unsupported view mode." />
          </div>
        }
      />
    </div>
  );
};
