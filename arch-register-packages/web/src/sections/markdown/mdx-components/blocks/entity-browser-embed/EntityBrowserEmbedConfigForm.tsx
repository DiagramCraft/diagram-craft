import { useEffect } from 'react';
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
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
  getDisplayFieldIds,
  withDisplayFieldIds,
  withoutDisplayFieldIds
} from '../../../../entities/components/entityDisplayFields';
import styles from './EntityBrowserEmbedDialog.module.css';

type Props = {
  projectId?: string;
  initialConfig: EntityBrowserEmbedConfig | null;
  onChange: (config: EntityBrowserEmbedConfig) => void;
};

export const EntityBrowserEmbedConfigForm = ({ projectId, initialConfig, onChange }: Props) => {
  const { workspaceSlug, schemas, enums, lifecycleStates, projects } = useWorkspaceContext();

  const {
    activeViewConfig,
    conditions,
    ownerFilter,
    projectScope,
    q,
    setConditions,
    setActiveViewConfig,
    setProjectScope,
    setQ,
    setSort,
    setView,
    sort,
    statusFilter,
    typeFilter,
    view,
    viewConfigs
  } = useEntityBrowserLocalState({
    projectId,
    initial: initialConfig
      ? {
          q: initialConfig.q,
          conditions: initialConfig.conditions,
          projectScope: initialConfig.projectScope,
          sort: initialConfig.sort,
          view: initialConfig.view,
          viewConfigs: initialConfig.viewConfigs
        }
      : undefined
  });

  useEffect(() => {
    onChange({ q, conditions, sort, view, viewConfigs, projectScope });
  }, [q, conditions, sort, view, viewConfigs, projectScope, onChange]);

  const displayFields = buildEntityDisplayFields(
    typeFilter ? schemas.filter(s => s.id === typeFilter) : schemas,
    !!projectId
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
      projectScope
    });

  const { filtered, filteredCount, owners, schemaMap, sortOptions } = useEntityBrowserData({
    workspaceId: workspaceSlug,
    projectId,
    projectScope,
    schemas,
    q,
    conditions,
    typeFilter,
    ownerFilter,
    statusFilter,
    sort,
    view,
    pageIndex,
    pageSize
  });

  return (
    <div className={styles.body}>
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
        sort={sort}
        setSort={setSort}
        sortOptions={sortOptions}
        view={view}
        setView={setView}
        displayFields={displayView ? displayFields : undefined}
        selectedDisplayFieldIds={
          displayView ? getDisplayFieldIds(displayView, activeViewConfig) : undefined
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
          displayFields={displayFields}
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
