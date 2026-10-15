import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import type { ConfigFormProps } from '../../shared/types';
import { useEffect, useMemo } from 'react';
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { EntityBrowserToolbar } from '../../../sections/entities/components/EntityBrowserToolbar';
import { EntityBrowserView } from '../../../sections/entities/components/EntityBrowserView';
import { stripEmptyGroups } from '../../../sections/entities/components/entityBrowserState';
import { useEntityBrowserLocalState } from '../../../sections/entities/components/useEntityBrowserLocalState';
import { useEntityBrowserData } from '../../../sections/entities/components/useEntityBrowserData';
import { useEntityBrowserPagination } from '../../../sections/entities/components/useEntityBrowserPagination';
import { FilterDropdown } from '../../../components/FilterDropdown';
import type { ColumnRenderConfig } from '@arch-register/api-types/viewContract';
import type { EntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';
import {
  buildEntityDisplayFields,
  DISPLAY_FIELD_VIEWS,
  filterDisplayFieldIdsForContext,
  getDisplayFieldIds,
  withColumnRenderers,
  withDisplayFieldIds,
  withoutDisplayFieldIds
} from '../../../sections/entities/components/entityDisplayFields';
import { resolveConfigVariables } from '../../../sections/dashboard/resolveSidebarVariableReferences';
import { EntityBrowserEmbedAdvancedConfig } from './EntityBrowserEmbedAdvancedConfig';
import { resolveMapOverlays } from '../../../sections/entities/components/mapOverlays';
import {
  resolveEntityQuery,
  resolveMapViewConfig,
  resolveSort
} from './EntityBrowserEmbedFieldResolution';
import dialogStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import styles from './EntityBrowserEmbedConfigForm.module.css';

type Props = ConfigFormProps<EntityBrowserEmbedConfig>;

export const EntityBrowserEmbedConfigForm = ({ config, onChange }: Props) => {
  const { projectId } = useMdxContext();
  const { workspaceSlug, schemas, relationSchemas, enums, lifecycleStates, projects } =
    useWorkspaceContext();

  const {
    activeViewConfig,
    conditions,
    entityQuery,
    ownerFilter,
    projectScope,
    q,
    setConditions,
    setEntityQuery,
    setActiveViewConfig,
    setProjectScope,
    setQ,
    setSort,
    setView,
    sort,
    statusFilter,
    typeFilter: conditionTypeFilter,
    view,
    viewConfigs
  } = useEntityBrowserLocalState({
    projectId,
    initial: {
      q: config.q,
      conditions: config.conditions,
      projectScope: config.projectScope,
      sort: config.sort,
      view: config.view,
      viewConfigs: config.viewConfigs,
      entityQuery: config.entityQuery ?? null
    }
  });

  useEffect(() => {
    onChange({
      q,
      conditions,
      sort,
      view,
      viewConfigs,
      projectScope,
      ...(entityQuery ? { entityQuery } : {}),
      ...(config.schemaName ? { schemaName: config.schemaName } : {}),
      ...(config.limit ? { limit: config.limit } : {}),
      ...(config.interactive ? { interactive: true } : {}),
      ...(config.overlays ? { overlays: config.overlays } : {}),
      ...(config.dimOwnerIds ? { dimOwnerIds: config.dimOwnerIds } : {})
    });
  }, [
    q,
    conditions,
    sort,
    view,
    viewConfigs,
    projectScope,
    entityQuery,
    config.schemaName,
    config.limit,
    config.interactive,
    config.overlays,
    config.dimOwnerIds,
    onChange
  ]);

  // Same schemaName -> id resolution the rendered embed does, so the preview matches it.
  const schemaNameId = config.schemaName
    ? schemas.find(schema => schema.name === config.schemaName)?.id
    : undefined;
  const typeFilter = conditionTypeFilter ?? schemaNameId ?? null;
  // A seeded sort may name its field; resolve it to the live id so the preview sorts too.
  const effectiveSort = resolveSort(
    sort,
    typeFilter ? schemas.find(schema => schema.id === typeFilter) : undefined
  );

  // The stored query may carry field NAMES and `$variable` references that only make sense at
  // render time (see EntityBrowserEmbedFieldResolution.ts / resolveSidebarVariableReferences.ts).
  // The dialog has no sidebar, so preview against the resolved query with every variable empty -
  // an empty `in` is dropped as "no constraint" - rather than sending the raw query, which the
  // server rejects with a 400. The stored query is left untouched.
  const previewEntityQuery = useMemo(() => {
    if (!entityQuery) return null;
    const variables = Object.fromEntries(
      [...JSON.stringify(entityQuery).matchAll(/\$(\w+)/g)].map(([, name]) => [name!, ''])
    );
    const rootSchema = typeFilter ? schemas.find(schema => schema.id === typeFilter) : undefined;
    return stripEmptyGroups(
      resolveEntityQuery(
        resolveConfigVariables(
          entityQuery as unknown as Record<string, unknown>,
          variables
        ) as typeof entityQuery,
        rootSchema,
        typeFilter
      )
    );
  }, [entityQuery, schemas, typeFilter]);

  // A seeded map names its level schemas; resolve them to live ids (as the rendered embed does)
  // so the Hierarchy section shows the selected types. Edits then save the resolved ids.
  const resolvedActiveViewConfig = useMemo(
    () => (view === 'map' ? resolveMapViewConfig(activeViewConfig, schemas) : activeViewConfig),
    [view, activeViewConfig, schemas]
  );
  const mapOverlays = useMemo(
    () =>
      view === 'map'
        ? resolveMapOverlays(
            config.overlays,
            typeFilter ? schemas.find(schema => schema.id === typeFilter) : undefined
          )
        : undefined,
    [view, config.overlays, typeFilter, schemas]
  );

  const displayFields = useMemo(
    () =>
      buildEntityDisplayFields(
        typeFilter ? schemas.filter(s => s.id === typeFilter) : schemas,
        !!projectId,
        null,
        entityQuery?.projections ?? []
      ),
    [schemas, typeFilter, projectId, entityQuery?.projections]
  );
  const displayView = DISPLAY_FIELD_VIEWS.has(view)
    ? (view as 'table' | 'cards' | 'tree' | 'explore' | 'map')
    : null;

  const isPagedBrowse = (view === 'table' || view === 'cards') && sort === 'name';
  const { goToNextPage, goToPreviousPage, handlePageSizeChange, pageIndex, pageSize } =
    useEntityBrowserPagination({
      isPagedBrowse,
      q,
      conditions,
      typeFilter,
      ownerFilter,
      statusFilter,
      projectId,
      projectScope,
      entityQuery: previewEntityQuery
    });

  const { filtered, filteredCount, isLoading, owners, schemaMap, sortOptions } =
    useEntityBrowserData({
      workspaceId: workspaceSlug,
      projectId,
      projectScope,
      schemas,
      q,
      conditions,
      typeFilter,
      ownerFilter,
      statusFilter,
      sort: effectiveSort,
      view,
      pageIndex,
      pageSize,
      activeViewConfig,
      entityQuery: previewEntityQuery
    });

  return (
    <div className={styles.body}>
      <div className={styles.options}>
        <label className={dialogStyles.optionRow}>
          <span className={dialogStyles.optionLabel}>Max rows</span>
          <NumberInput
            value={config.limit ?? ''}
            min={1}
            step={1}
            placeholder="All"
            style={{ width: '80px' }}
            onChange={value =>
              onChange({
                ...config,
                limit: value !== undefined && value >= 1 ? Math.floor(value) : undefined
              })
            }
          />
        </label>
        {(view === 'table' || view === 'cards') && (
          <label className={dialogStyles.optionRow}>
            <span className={dialogStyles.optionLabel}>Search &amp; pagination</span>
            <Checkbox
              value={config.interactive ?? false}
              onChange={value => onChange({ ...config, interactive: value ? true : undefined })}
            />
          </label>
        )}
      </div>
      <EntityBrowserEmbedAdvancedConfig config={config} onChange={onChange} />
      <EntityBrowserToolbar
        workspaceId={workspaceSlug}
        q={q}
        setQ={setQ}
        conditions={conditions}
        setConditions={setConditions}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        owners={owners}
        enums={enums}
        typeFilter={typeFilter}
        projectId={projectId}
        projectScope={projectScope}
        setProjectScope={setProjectScope}
        sort={effectiveSort}
        setSort={setSort}
        sortOptions={sortOptions}
        view={view}
        setView={setView}
        entityQuery={entityQuery}
        setEntityQuery={setEntityQuery}
        displayFields={displayView ? displayFields : undefined}
        selectedDisplayFieldIds={
          displayView
            ? filterDisplayFieldIdsForContext(
                getDisplayFieldIds(displayView, activeViewConfig),
                !!projectId
              )
            : undefined
        }
        onDisplayFieldsChange={
          displayView
            ? ids => setActiveViewConfig(withDisplayFieldIds(activeViewConfig, ids))
            : undefined
        }
        columnRenderers={
          view === 'table'
            ? (activeViewConfig as { columnRenderers?: Record<string, ColumnRenderConfig> } | null)
                ?.columnRenderers
            : undefined
        }
        onColumnRenderersChange={
          view === 'table'
            ? renderers => setActiveViewConfig(withColumnRenderers(activeViewConfig, renderers))
            : undefined
        }
        onDisplayFieldsReset={
          displayView
            ? () => setActiveViewConfig(withoutDisplayFieldIds(activeViewConfig))
            : undefined
        }
      />
      <div className={styles.viewArea}>
        <EntityBrowserView
          view={view}
          rows={filtered}
          schemaMap={schemaMap}
          schemas={schemas}
          relationSchemas={relationSchemas}
          lifecycleStates={lifecycleStates}
          projects={projects}
          workspaceId={workspaceSlug}
          projectId={projectId}
          projectScope={projectScope}
          q={q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          activeViewConfig={resolvedActiveViewConfig}
          // The map and tree fetch their own data, so they need the resolved query and conditions.
          conditions={view === 'map' || view === 'tree' ? conditions : undefined}
          entityQuery={view === 'map' || view === 'tree' ? previewEntityQuery : undefined}
          executionEntityQuery={view === 'map' || view === 'tree' ? previewEntityQuery : undefined}
          mapOverlays={mapOverlays}
          mapDimOwnerIds={config.dimOwnerIds}
          sort={effectiveSort}
          onSortChange={setSort}
          displayFields={displayFields}
          isLoading={isLoading}
          mode={{ kind: 'configure', onConfigChange: setActiveViewConfig }}
        />
      </div>
      {isPagedBrowse && (
        <div className={styles.pagination}>
          <FilterDropdown
            label="Page Size"
            variant={'secondary'}
            value={String(pageSize)}
            onChange={handlePageSizeChange}
            options={[
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
              { value: '200', label: '200' }
            ]}
          />
          <div style={{ marginLeft: 'auto' }}>
            <Button
              size="sm"
              variant="secondary"
              icon={<TbChevronLeft size={12} />}
              disabled={pageIndex === 0}
              onClick={goToPreviousPage}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<TbChevronRight size={12} />}
              disabled={filteredCount < pageSize}
              onClick={goToNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
