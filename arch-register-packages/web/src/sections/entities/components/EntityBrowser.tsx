import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Select } from '@diagram-craft/app-components/Select';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { FilterDropdown } from '../../../components/FilterDropdown';
import type { WorkspaceTeam } from '../../../lib/api';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { RadarView } from '../components/RadarView';
import { TimelineView } from '../components/TimelineView';
import { MatrixView } from '../components/MatrixView';
import { HierarchyView } from '../components/HierarchyView';
import { ExploreView } from '../components/ExploreView';
import { BulkEditToolbar } from './BulkEditToolbar';
import { CardsView } from './CardsView';
import { TableView } from './TableView';
import { TreeView } from './TreeView';
import { type ProjectBrowserContext } from './entityBrowserState';
import { EntityBrowserToolbar } from './EntityBrowserToolbar';
import { useEntityBrowserData } from './useEntityBrowserData';
import { useEntityBrowserEntityActions } from './useEntityBrowserEntityActions';
import { useEntityBrowserPagination } from './useEntityBrowserPagination';
import { useEntityBrowserSearchState } from './useEntityBrowserSearchState';
import { useEntityBrowserSelection } from './useEntityBrowserSelection';
import styles from './EntityBrowser.module.css';

type EntityBrowserProps = {
  projectContext?: ProjectBrowserContext;
  onCountChange?: (count: number) => void;
};

export const SaveViewDialog = ({
  open,
  onClose,
  onSave,
  scopeOptions,
  defaultScope,
  showAdminOption
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, scope: 'workspace' | 'project', isAdminView: boolean) => void;
  scopeOptions?: Array<{ value: 'workspace' | 'project'; label: string }>;
  defaultScope?: 'workspace' | 'project';
  showAdminOption?: boolean;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAdminView, setIsAdminView] = useState(false);
  const resolvedDefaultScope =
    scopeOptions?.find(option => option.value === defaultScope)?.value ??
    scopeOptions?.[0]?.value ??
    defaultScope ??
    'workspace';
  const [scope, setScope] = useState<'workspace' | 'project'>(resolvedDefaultScope);

  useEffect(() => {
    if (open) {
      setScope(resolvedDefaultScope);
      setIsAdminView(false);
    }
  }, [open, resolvedDefaultScope]);

  const handleSave = () => {
    onSave(name, description, scope, isAdminView);
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
            <Select.Root
              value={scope}
              onChange={value =>
                setScope((value as 'workspace' | 'project') ?? resolvedDefaultScope)
              }
            >
              {scopeOptions.map(option => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        )}
        {showAdminOption && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <Checkbox
              value={isAdminView}
              onChange={v => setIsAdminView(v ?? false)}
            />
            <span>Pin as workspace view (visible to all members)</span>
          </label>
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
    asOf,
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
  const readOnly = !!asOf;
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
    asOf,
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
    addFieldRow,
    availableFields,
    clearSelection,
    fieldRows,
    handleConfirm,
    handleSelectAll,
    handleSelectRow,
    removeFieldRow,
    result,
    selectedEntities,
    selectedIds,
    setStep,
    step,
    updateFieldRow
  } = useEntityBrowserSelection({
    workspaceId,
    entities,
    filtered,
    filteredCount,
    schemaMap
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
        readOnly={readOnly}
      />
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
          readOnly={readOnly}
        />
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No entities found</div>
          <div>Try adjusting your search or filters.</div>
        </div>
      ) : (
        <>
          {view === 'table' && !readOnly && selectedIds.size > 0 && (
            <BulkEditToolbar
              workspaceId={workspaceId}
              count={selectedIds.size}
              selectedEntities={selectedEntities}
              fieldRows={fieldRows}
              availableFields={availableFields}
              step={step}
              result={result}
              lifecycleStates={lifecycleStates}
              teams={teams as WorkspaceTeam[]}
              addFieldRow={addFieldRow}
              updateFieldRow={updateFieldRow}
              removeFieldRow={removeFieldRow}
              setStep={setStep}
              onClear={clearSelection}
              onConfirm={handleConfirm}
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
              readOnly={readOnly}
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
              readOnly={readOnly}
            />
          )}
        </>
      )}
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
      <DeleteConfirmationDialog
        open={!!hookDeleteTarget}
        title="Delete entity?"
        message={
          hookDeleteTarget ? (
            <>
              The entity <b>{hookDeleteTarget._name || hookDeleteTarget._slug}</b> will be
              permanently deleted.
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
