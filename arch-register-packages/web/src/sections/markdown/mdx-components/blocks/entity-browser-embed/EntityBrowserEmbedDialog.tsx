import { useEffect, useMemo } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { EntityBrowserToolbar } from '../../../../entities/components/EntityBrowserToolbar';
import { EntityBrowserView } from '../../../../entities/components/EntityBrowserView';
import { useEntityBrowserLocalState } from '../../../../entities/components/useEntityBrowserLocalState';
import { useEntityBrowserData } from '../../../../entities/components/useEntityBrowserData';
import { useEntityBrowserPagination } from '../../../../entities/components/useEntityBrowserPagination';
import { FilterDropdown } from '../../../../../components/FilterDropdown';
import type { EntityBrowserEmbedSlateElement } from './types';
import {
  decodeEntityBrowserEmbedConfig,
  encodeEntityBrowserEmbedConfig,
  type EntityBrowserEmbedConfig
} from './EntityBrowserEmbedCodec';
import styles from './EntityBrowserEmbedDialog.module.css';
import { buildEntityDisplayFields, DISPLAY_FIELD_VIEWS, getDisplayFieldIds, withDisplayFieldIds, withoutDisplayFieldIds } from '../../../../entities/components/entityDisplayFields';

const noop = () => {};

export const EntityBrowserEmbedDialog = ({
  element,
  open,
  onClose,
  isNew
}: {
  element: TElement;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
}) => {
  const editor = useEditorRef();
  const el = element as EntityBrowserEmbedSlateElement;
  const { workspaceSlug, schemas, enums, lifecycleStates, projects } = useWorkspaceContext();
  const { projectId } = useMdxContext();

  const initialConfig = useMemo(() => decodeEntityBrowserEmbedConfig(el.config), [el.config]);

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
    setViewConfigs,
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
  const displayFields = useMemo(() => buildEntityDisplayFields(typeFilter ? schemas.filter(s => s.id === typeFilter) : schemas, !!projectId), [schemas, typeFilter, projectId]);
  const displayView = DISPLAY_FIELD_VIEWS.has(view) ? view as 'table' | 'cards' | 'tree' | 'hierarchy' | 'explore' : null;

  useEffect(() => {
    if (!open) return;

    setQ(initialConfig?.q ?? '');
    setConditions(initialConfig?.conditions ?? []);
    setProjectScope(projectId ? (initialConfig?.projectScope ?? 'project') : 'all');
    setSort(initialConfig?.sort ?? 'name');
    setView(initialConfig?.view ?? 'table');
    setViewConfigs(initialConfig?.viewConfigs ?? {});
  }, [
    initialConfig,
    open,
    projectId,
    setConditions,
    setProjectScope,
    setQ,
    setSort,
    setView,
    setViewConfigs
  ]);

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

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    const snapshot: EntityBrowserEmbedConfig = {
      q,
      conditions,
      sort,
      view,
      viewConfigs,
      projectScope
    };
    editor.tf.setNodes({ config: encodeEntityBrowserEmbedConfig(snapshot) }, { at: path });
    onClose();
  };

  const handleClose = () => {
    if (isNew) {
      const path = editor.api.findPath(element);
      if (path) editor.tf.removeNodes({ at: path });
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Entity browser"
      width={'min(1200px, 92vw)'}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', onClick: handleConfirm }
      ]}
    >
      <div className={styles.body}>
        <EntityBrowserToolbar
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
          selectedDisplayFieldIds={displayView ? getDisplayFieldIds(displayView, activeViewConfig) : undefined}
          onDisplayFieldsChange={displayView ? ids => setActiveViewConfig(withDisplayFieldIds(activeViewConfig, ids)) : undefined}
          onDisplayFieldsReset={displayView ? () => setActiveViewConfig(withoutDisplayFieldIds(activeViewConfig)) : undefined}
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
            onConfigChange={setActiveViewConfig}
            onEntityClick={noop}
            readOnly
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
    </Dialog>
  );
};
