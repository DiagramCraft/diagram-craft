import { useEffect, useMemo } from 'react';
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { EntityBrowserToolbar } from '../../../../entities/components/EntityBrowserToolbar';
import { EntityBrowserView } from '../../../../entities/components/EntityBrowserView';
import { useEntityBrowserLocalState } from '../../../../entities/components/useEntityBrowserLocalState';
import { useEntityBrowserData } from '../../../../entities/components/useEntityBrowserData';
import { useEntityBrowserPagination } from '../../../../entities/components/useEntityBrowserPagination';
import { FilterDropdown } from '../../../../../components/FilterDropdown';
import type { EntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';
import {
  buildEntityDisplayFields,
  DISPLAY_FIELD_VIEWS,
  filterDisplayFieldIdsForContext,
  getDisplayFieldIds,
  withDisplayFieldIds,
  withoutDisplayFieldIds
} from '../../../../entities/components/entityDisplayFields';
import { resolveConfigVariables } from '../../../../dashboard/resolveSidebarVariableReferences';
import { resolveEntityQuery, resolveSort } from './EntityBrowserEmbedFieldResolution';
import dialogStyles from '../../../../dashboard/WidgetConfigDialog.module.css';
import styles from './EntityBrowserEmbedConfigForm.module.css';

type Props = {
  config: EntityBrowserEmbedConfig;
  onChange: (config: EntityBrowserEmbedConfig) => void;
  context: { projectId?: string };
};

export const EntityBrowserEmbedConfigForm = ({ config, onChange, context }: Props) => {
  const { projectId } = context;
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
      ...(config.title ? { title: config.title } : {}),
      ...(config.limit ? { limit: config.limit } : {})
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
    config.title,
    config.limit,
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
    return resolveEntityQuery(
      resolveConfigVariables(
        entityQuery as unknown as Record<string, unknown>,
        variables
      ) as typeof entityQuery,
      rootSchema,
      typeFilter
    );
  }, [entityQuery, schemas, typeFilter]);

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
          <span className={dialogStyles.optionLabel}>Title</span>
          <TextInput
            value={config.title ?? ''}
            placeholder="Entity browser"
            onChange={value => onChange({ ...config, title: value })}
          />
        </label>
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
      </div>
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
          activeViewConfig={activeViewConfig}
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
