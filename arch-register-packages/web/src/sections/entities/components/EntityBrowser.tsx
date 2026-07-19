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
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { BulkEditToolbar } from './BulkEditToolbar';
import { type ProjectBrowserContext } from './entityBrowserState';
import { EntityBrowserView } from './EntityBrowserView';
import { EntityBrowserToolbar } from './EntityBrowserToolbar';
import { useEntityBrowserData } from './useEntityBrowserData';
import { useEntityBrowserEntityActions } from './useEntityBrowserEntityActions';
import { useEntityBrowserPagination } from './useEntityBrowserPagination';
import { useEntityBrowserSearchState } from './useEntityBrowserSearchState';
import { useEntityBrowserSelection } from './useEntityBrowserSelection';
import { resolveJoinAssessmentId, useJoinedAssessment } from './useJoinedAssessment';
import { TimelineStrip, type AsOfMarker } from '../../../components/timeline/TimelineStrip';
import { EmptyState } from '../../../components/EmptyState';
import styles from './EntityBrowser.module.css';
import {
  buildEntityDisplayFields,
  DISPLAY_FIELD_VIEWS,
  getDisplayFieldIds,
  withDisplayFieldIds,
  withoutDisplayFieldIds
} from './entityDisplayFields';
import type { BrowserEntityRecord } from './entityBrowserState';
import { CollectionPickerDialog } from './CollectionPickerDialog';

type EntityBrowserProps = {
  projectContext?: ProjectBrowserContext;
  onCountChange?: (count: number) => void;
  timelineMarkers?: AsOfMarker[];
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
  onSave: (
    name: string,
    description: string,
    scope: 'workspace' | 'project',
    isAdminView: boolean
  ) => void;
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
        <FormElement label="Name" required>
          <TextInput
            value={name}
            onChange={v => setName(v ?? '')}
            placeholder="e.g. Production components"
            autoFocus
          />
        </FormElement>
        <FormElement label="Description" required={false}>
          <TextArea
            value={description}
            onChange={v => setDescription(v ?? '')}
            placeholder="What this view shows…"
          />
        </FormElement>
        {scopeOptions != null && scopeOptions.length > 1 && (
          <FormElement label="Save to" required>
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
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <Checkbox value={isAdminView} onChange={v => setIsAdminView(v ?? false)} />
            <span>Pin as workspace view (visible to all members)</span>
          </label>
        )}
      </div>
    </Dialog>
  );
};

export const EntityBrowser = ({
  projectContext,
  onCountChange,
  timelineMarkers = []
}: EntityBrowserProps) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, enums, lifecycleStates, teams, projects } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const projectId = projectContext?.project.id;
  const {
    asOf,
    includeProjectSnapshots,
    setAsOf,
    clearAsOf,
    setIncludeProjectSnapshots,
    conditions,
    activeViewConfig,
    collectionId,
    joinAssessmentId,
    ownerFilter,
    projectScope,
    q,
    setConditions,
    setActiveViewConfig,
    setJoinAssessmentId,
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
  const {
    options: joinOptions,
    joined,
    responsesByEntity,
    isReady: assessmentsReady
  } = useJoinedAssessment(workspaceId, joinAssessmentId, projectId);
  const effectiveJoinAssessmentId = resolveJoinAssessmentId(
    joinAssessmentId,
    joinOptions,
    projectId
  );

  useEffect(() => {
    if (projectId && assessmentsReady && joinAssessmentId && !effectiveJoinAssessmentId) {
      setJoinAssessmentId(null);
    }
  }, [
    assessmentsReady,
    effectiveJoinAssessmentId,
    joinAssessmentId,
    projectId,
    setJoinAssessmentId
  ]);
  const readOnly = !!asOf && !collectionId;
  const [tlOpen, setTlOpen] = useState(!!asOf && !collectionId);
  const [collectionTarget, setCollectionTarget] = useState<BrowserEntityRecord | null>(null);
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
      collectionId,
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
    collectionId,
    projectScope,
    schemas,
    q,
    conditions,
    joinAssessmentId: effectiveJoinAssessmentId,
    typeFilter,
    ownerFilter,
    statusFilter,
    sort,
    view,
    pageIndex,
    pageSize,
    asOf,
    includeProjectSnapshots: projectId ? true : includeProjectSnapshots,
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
      setSort('name', true);
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
  const displayFieldSchemas = useMemo(
    () => (typeFilter ? schemas.filter(schema => schema.id === typeFilter) : schemas),
    [schemas, typeFilter]
  );
  const joinedAssessmentContext = useMemo(
    () => (joined ? { assessment: joined.assessment, enums } : null),
    [joined, enums]
  );
  const displayFields = useMemo(
    () => buildEntityDisplayFields(displayFieldSchemas, !!projectContext, joinedAssessmentContext),
    [displayFieldSchemas, projectContext, joinedAssessmentContext]
  );
  const displayView = DISPLAY_FIELD_VIEWS.has(view)
    ? (view as 'table' | 'cards' | 'tree' | 'explore' | 'map')
    : null;
  const selectedDisplayFieldIds = displayView
    ? getDisplayFieldIds(displayView, activeViewConfig)
    : undefined;
  const joinedRows = useMemo<BrowserEntityRecord[]>(() => {
    if (!joined) return filtered;
    return filtered.map(row => ({ ...row, _assessment: responsesByEntity.get(row._uid) ?? null }));
  }, [filtered, joined, responsesByEntity]);

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
        tlOpen={tlOpen}
        onToggleTimeline={collectionId ? undefined : () => setTlOpen(o => !o)}
        asOf={collectionId ? undefined : asOf}
        allowedViews={
          collectionId
            ? [
                { value: 'table', label: 'Table' },
                { value: 'cards', label: 'Cards' }
              ]
            : undefined
        }
        displayFields={displayView && !readOnly ? displayFields : undefined}
        selectedDisplayFieldIds={!readOnly ? selectedDisplayFieldIds : undefined}
        onDisplayFieldsChange={
          displayView && !readOnly
            ? fieldIds => setActiveViewConfig(withDisplayFieldIds(activeViewConfig, fieldIds))
            : undefined
        }
        onDisplayFieldsReset={
          displayView && !readOnly
            ? () => setActiveViewConfig(withoutDisplayFieldIds(activeViewConfig))
            : undefined
        }
        joinOptions={joinOptions}
        joinAssessmentId={effectiveJoinAssessmentId}
        onJoinAssessmentChange={setJoinAssessmentId}
        joinedAssessment={joined?.assessment}
      />
      {!collectionId && tlOpen && (
        <TimelineStrip
          markers={timelineMarkers}
          selectedDate={asOf}
          onSelect={setAsOf}
          onClear={clearAsOf}
          onClose={() => setTlOpen(false)}
          includeProjectSnapshots={projectId ? undefined : includeProjectSnapshots}
          onToggleIncludeProjectSnapshots={projectId ? undefined : setIncludeProjectSnapshots}
        />
      )}

      {(view === 'table' || view === 'cards') && filtered.length === 0 ? (
        <EmptyState title="No entities found" subtitle="Try adjusting your search or filters." />
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
          <EntityBrowserView
            view={view}
            rows={joinedRows}
            schemaMap={schemaMap}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            projects={projects}
            workspaceId={workspaceId}
            projectId={projectId}
            projectScope={projectScope}
            q={q}
            typeFilter={typeFilter}
            ownerFilter={ownerFilter}
            statusFilter={statusFilter}
            activeViewConfig={activeViewConfig}
            displayFields={displayFields}
            projectContext={projectContext}
            linkedEntityIds={linkedEntityIds}
            activeDateField={dateBrowserEnabled ? activeDateField : null}
            joinAssessmentId={effectiveJoinAssessmentId}
            joinedAssessment={joinedAssessmentContext}
            responsesByEntity={responsesByEntity}
            mode={
              readOnly
                ? {
                    kind: 'snapshot',
                    onConfigChange: setActiveViewConfig,
                    onEntityClick: navigateToEntity
                  }
                : {
                    kind: 'interactive',
                    onConfigChange: setActiveViewConfig,
                    onEntityClick: navigateToEntity,
                    onDelete: handleDeleteEntity,
                    onClone: handleCloneEntity,
                    onManageCollections: entity => setCollectionTarget(entity),
                    selectedIds,
                    onSelectAll: handleSelectAll,
                    onSelectRow: handleSelectRow
                  }
            }
          />
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
              The entity <b>{hookDeleteTarget._name ?? hookDeleteTarget._slug}</b> will be
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
      {collectionTarget && (
        <CollectionPickerDialog
          open={true}
          workspaceId={workspaceId}
          entityId={collectionTarget._uid}
          entityName={collectionTarget._name ?? collectionTarget._slug}
          onClose={() => setCollectionTarget(null)}
        />
      )}
    </>
  );
};
