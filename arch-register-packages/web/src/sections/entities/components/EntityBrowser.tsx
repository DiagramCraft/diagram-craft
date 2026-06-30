import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  TbSearch,
  TbChevronLeft,
  TbChevronRight,
  TbFilter,
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Select } from '@diagram-craft/app-components/Select';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { FilterBuilder } from '../../../components/FilterBuilder';
import { FilterDropdown } from '../../../components/FilterDropdown';
import type { WorkspaceTeam } from '../../../lib/api';
import { type BrowserView } from '@arch-register/api-types/viewContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  asEntityPublicId,
  entityDetailRoute
} from '../../../routes/publicObjectRoutes';
import { RadarView } from '../components/RadarView';
import { TimelineView } from '../components/TimelineView';
import { MatrixView } from '../components/MatrixView';
import { HierarchyView } from '../components/HierarchyView';
import { ExploreView } from '../components/ExploreView';
import {
  BulkEditToolbar,
  CardsView,
  TableView,
  TreeView
} from './EntityBrowserListViews';
import {
  type ProjectBrowserContext,
} from './entityBrowserState';
import { useEntityBrowserData } from './useEntityBrowserData';
import { useEntityBrowserEntityActions } from './useEntityBrowserEntityActions';
import { useEntityBrowserPagination } from './useEntityBrowserPagination';
import { useEntityBrowserSearchState } from './useEntityBrowserSearchState';
import { useEntityBrowserSelection } from './useEntityBrowserSelection';
import styles from '../EntityBrowserScreen.module.css';

type EntityBrowserProps = {
  projectContext?: ProjectBrowserContext;
  onCountChange?: (count: number) => void;
};

export const SaveViewDialog = ({
  open,
  onClose,
  onSave,
  scopeOptions,
  defaultScope
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, scope: 'workspace' | 'project') => void;
  scopeOptions?: Array<{ value: 'workspace' | 'project'; label: string }>;
  defaultScope?: 'workspace' | 'project';
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const resolvedDefaultScope =
    scopeOptions?.find(option => option.value === defaultScope)?.value ??
    scopeOptions?.[0]?.value ??
    defaultScope ??
    'workspace';
  const [scope, setScope] = useState<'workspace' | 'project'>(resolvedDefaultScope);

  useEffect(() => {
    if (open) {
      setScope(resolvedDefaultScope);
    }
  }, [open, resolvedDefaultScope]);

  const handleSave = () => {
    onSave(name, description, scope);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save current view as"
      sub="Save your current filters and view configuration to access them quickly later."
      buttons={[
        { label: 'Cancel', type: 'secondary', onClick: onClose },
        { label: 'Save view', type: 'default', onClick: handleSave, disabled: !name.trim() }
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormElement label="Name">
          <TextInput
            value={name}
            onChange={v => setName(v ?? '')}
            placeholder="e.g. Production components"
            autoFocus
          />
        </FormElement>
        <FormElement label="Description (optional)">
          <TextArea
            value={description}
            onChange={v => setDescription(v ?? '')}
            placeholder="What this view shows…"
          />
        </FormElement>
        {scopeOptions != null && scopeOptions.length > 1 && (
          <FormElement label="Save to">
            <Select.Root value={scope} onChange={value => setScope((value as 'workspace' | 'project') ?? resolvedDefaultScope)}>
              {scopeOptions.map(option => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        )}
      </div>
    </Dialog>
  );
};

export const EntityBrowser = ({ projectContext, onCountChange }: EntityBrowserProps) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, enums, lifecycleStates, teams, projects } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const projectId = projectContext?.project.id;
  const {
    conditions,
    activeViewConfig,
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
    view
  } = useEntityBrowserSearchState({
    workspaceSlug,
    projectId
  });
  const filterPopoverRef = useRef<PopoverActions | null>(null);
  const isPagedBrowse = (view === 'table' || view === 'cards') && sort === 'name';
  const {
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    pageIndex,
    pageSize
  } = useEntityBrowserPagination({
    isPagedBrowse,
    q,
    conditions,
    typeFilter,
    ownerFilter,
    statusFilter,
    projectId,
    projectScope
  });
  const {
    activeDateField,
    dateFields,
    entities,
    filtered,
    filteredCount,
    owners,
    schemaMap,
    sortOptions
  } = useEntityBrowserData({
    workspaceId,
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
    pageSize,
    onCountChange
  });

  const navigateToEntity = useCallback(
    (entityId: string) => {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
    },
    [navigate, workspaceSlug]
  );

  const {
    confirmDeleteEntity,
    deleteTarget: hookDeleteTarget,
    handleCloneEntity,
    handleDeleteEntity,
    setDeleteTarget: setHookDeleteTarget
  } = useEntityBrowserEntityActions({
    workspaceId,
    onNavigateToEntity: navigateToEntity
  });
  const {
    bulkConfirming,
    bulkLifecycleValue,
    bulkOwnerValue,
    clearSelection,
    doBulkUpdate,
    handleSelectAll,
    handleSelectRow,
    selectedIds,
    setBulkConfirming,
    setBulkLifecycleValue,
    setBulkOwnerValue
  } = useEntityBrowserSelection({
    workspaceId,
    entities,
    filtered,
    filteredCount
  });

  const selectedSchema = typeFilter != null ? (schemaMap.get(typeFilter)?.schema ?? null) : null;

  useEffect(() => {
    if (!sort.startsWith('date:')) return;
    const fieldId = sort.slice(5);
    if (view !== 'table' || !dateFields.some(field => field.id === fieldId)) {
      setSort('name');
    }
  }, [dateFields, sort, view, setSort]);
  const dateBrowserEnabled = view === 'table' && selectedSchema != null && dateFields.length > 0;

  useEffect(() => {
    clearSelection();
  }, [clearSelection]);

  const linkedEntityIds = useMemo(
    () =>
      projectContext
        ? filtered.filter(entity => entity._projectLink?.linked).map(entity => entity._uid)
        : undefined,
    [filtered, projectContext]
  );

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.searchInline}>
          <TbSearch size={12} />
          <input
            placeholder="Search by name, owner…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <Popover.Root actionsRef={filterPopoverRef}>
          <Popover.Trigger
            element={
              <Button size="sm" variant={conditions.length > 0 ? 'primary' : 'secondary'}>
                <TbFilter size={12} style={{ marginRight: 4 }} />
                Filter
                {conditions.length > 0 && (
                  <span className={styles.filterCount}>{conditions.length}</span>
                )}
              </Button>
            }
          />
          <Popover.Content
            sideOffset={4}
            align="start"
            arrow={false}
            closeButton={false}
            className={styles.filterPopover}
          >
            <FilterBuilder
              conditions={conditions}
              onChange={setConditions}
              onClose={() => filterPopoverRef.current?.close()}
              schemas={schemas}
              lifecycleStates={lifecycleStates}
              owners={owners}
              enums={enums}
              selectedSchemaId={typeFilter}
            />
          </Popover.Content>
        </Popover.Root>
        {projectId && (
          <FilterDropdown
            label="Scope"
            value={projectScope}
            onChange={v => setProjectScope((v as 'project' | 'all') ?? 'project')}
            options={[
              { value: 'project', label: 'Project entities only' },
              { value: 'all', label: 'All entities' }
            ]}
          />
        )}
        <div style={{ flex: 1 }} />
        <FilterDropdown label="Sort" value={sort} onChange={setSort} options={sortOptions} />
        <FilterDropdown
          label="View"
          value={view}
          onChange={v => setView(v as BrowserView)}
          options={[
            { value: 'table', label: 'Table' },
            { value: 'cards', label: 'Cards' },
            { value: 'tree', label: 'Tree' },
            { value: 'radar', label: 'Radar' },
            { value: 'timeline', label: 'Timeline' },
            { value: 'matrix', label: 'Matrix' },
            { value: 'hierarchy', label: 'Hierarchy' },
            { value: 'explore', label: 'Explore' }
          ]}
        />
      </div>
      {view === 'hierarchy' ? (
        <HierarchyView
          workspaceId={workspaceId}
          projectId={projectId}
          projectScope={projectScope}
          q={q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          onEntityClick={navigateToEntity}
          config={activeViewConfig}
          onConfigChange={setActiveViewConfig}
          linkedEntityIds={linkedEntityIds}
        />
      ) : view === 'explore' ? (
        <ExploreView
          rows={filtered}
          onEntityClick={navigateToEntity}
          config={activeViewConfig}
          onConfigChange={setActiveViewConfig}
          linkedEntityIds={linkedEntityIds}
        />
      ) : view === 'matrix' ? (
        <MatrixView
          rows={filtered}
          schemaMap={schemaMap}
          onEntityClick={navigateToEntity}
          config={activeViewConfig}
          onConfigChange={setActiveViewConfig}
          linkedEntityIds={linkedEntityIds}
        />
      ) : view === 'timeline' ? (
        <TimelineView
          rows={filtered}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          onEntityClick={navigateToEntity}
          config={activeViewConfig}
          onConfigChange={setActiveViewConfig}
          workspaceId={workspaceId}
          projects={projects}
          linkedEntityIds={linkedEntityIds}
        />
      ) : view === 'radar' ? (
        <RadarView
          rows={filtered}
          linkedEntityIds={linkedEntityIds}
          onEntityClick={navigateToEntity}
          config={activeViewConfig}
          onConfigChange={setActiveViewConfig}
        />
      ) : view === 'tree' ? (
        <TreeView
          workspaceId={workspaceId}
          projectId={projectId}
          projectScope={projectScope}
          q={q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          schemaMap={schemaMap}
          onEntityClick={navigateToEntity}
          onDelete={handleDeleteEntity}
          onClone={handleCloneEntity}
          lifecycleStates={lifecycleStates}
          projectContext={projectContext}
        />
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No entities found</div>
          <div>Try adjusting your search or filters.</div>
        </div>
      ) : (
        <>
          {view === 'table' && selectedIds.size > 0 && (
            <BulkEditToolbar
              selectedIds={selectedIds}
              bulkConfirming={bulkConfirming}
              setBulkConfirming={setBulkConfirming}
              bulkLifecycleValue={bulkLifecycleValue}
              setBulkLifecycleValue={setBulkLifecycleValue}
              bulkOwnerValue={bulkOwnerValue}
              setBulkOwnerValue={setBulkOwnerValue}
              lifecycleStates={lifecycleStates}
              teams={teams as WorkspaceTeam[]}
              onClear={clearSelection}
              onConfirm={doBulkUpdate}
            />
          )}
          {view === 'table' && (
            <TableView
              rows={filtered}
              schemaMap={schemaMap}
              activeDateField={dateBrowserEnabled ? activeDateField : null}
              onEntityClick={navigateToEntity}
              onDelete={handleDeleteEntity}
              onClone={handleCloneEntity}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelectRow={handleSelectRow}
              lifecycleStates={lifecycleStates}
              projectContext={projectContext}
            />
          )}
          {view === 'cards' && (
            <CardsView
              rows={filtered}
              schemaMap={schemaMap}
              onEntityClick={navigateToEntity}
              onDelete={handleDeleteEntity}
              onClone={handleCloneEntity}
              lifecycleStates={lifecycleStates}
              projectContext={projectContext}
            />
          )}
        </>
      )}
      {isPagedBrowse && (
        <div className={styles.pagination}>
          <Select.Root
            value={String(pageSize)}
            onChange={handlePageSizeChange}
            style={{ width: 88 }}
          >
            {[25, 50, 100, 200].map(size => (
              <Select.Item key={size} value={String(size)}>
                {size}
              </Select.Item>
            ))}
          </Select.Root>
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
      )}
      <DeleteConfirmationDialog
        open={!!hookDeleteTarget}
        title="Delete entity?"
        message={
          hookDeleteTarget ? (
            <>
              The entity <b>{hookDeleteTarget._name || hookDeleteTarget._slug}</b> will be permanently
              deleted.
            </>
          ) : (
            ''
          )
        }
        detail="This can't be undone."
        confirmLabel="Delete entity"
        onConfirm={confirmDeleteEntity}
        onCancel={() => setHookDeleteTarget(null)}
      />
    </>
  );
};
