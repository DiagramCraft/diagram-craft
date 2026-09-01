import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  TbDots,
  TbCheck,
  TbCopy,
  TbPencil,
  TbTrash,
  TbDownload,
  TbUpload,
  TbChevronLeft,
  TbChevronRight
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import styles from './RelationBrowser.module.css';
import filterStyles from '../entities/components/EntityBrowser.module.css';
import { Title } from '../../components/Title';
import { FilterDropdown } from '../../components/FilterDropdown';
import { Table } from '../../components/table/Table';
import { useTableSort } from '../../components/table/useTableSort';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { EntityNavigationLink } from '../../components/EntityNavigationLink';
import { asEntityPublicId, entityDetailRoute } from '../../routes/publicObjectRoutes';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useTeams, useLifecycleStates } from '../../hooks/useWorkspaceConfig';
import { useSavedViews, useCreateSavedView, useUpdateSavedView } from '../../hooks/useSavedViews';
import { useDeleteRelation } from '../../hooks/useRelations';
import { useEntitiesByIds } from '../../hooks/useEntities';
import { relationIds } from '../../lib/entityEditState';
import { RelationDetailPopover } from '../entities/components/RelationDetailPopover';
import { SaveViewDialog } from '../entities/components/EntityBrowser';
import { RelationEditDialog } from '../../dialogs/RelationEditDialog';
import { useRelationBrowserData } from './useRelationBrowserData';
import { RelationQueryModeControls } from './RelationQueryModeControls';
import {
  buildRelationQueryFromFilters,
  buildRelationSavedViewPayload,
  formatFieldValue,
  parseRelationTableFieldIdsFromSearch,
  type RelationBrowserView,
  RELATION_GRAPH_TYPE_LABEL
} from './relationBrowserState';
import { PROJECTION_FIELD_PREFIX } from '../entities/components/entityDisplayFields';
import { exportRelationsToCSV } from '../../lib/relationCsv';
import { downloadBlob } from '../../lib/browserDownload';
import { RelationGraphView } from './RelationGraphView';

// Standalone relation-rooted browser (#2689/#2784): lists relation instances via the /relations/query
// endpoint, distinct from the entity-embedded relation tab (EntityRelationsTab/RelationRecordList),
// which stays untouched. Graph view is deliberately flat: it uses only the matching relation
// instances and their endpoint entities, with no further traversal.
//
// No separate schema picker (#2698): "type" is just another filter condition (see
// RelationFilterBuilder.tsx/relationBrowserState.ts), so the browser shows relations across every
// schema at once by default, and every relation schema's fields are filterable regardless of Type.
// A "Type" column is always shown; per-schema field *columns* only make sense once the filters
// narrow to exactly one schema (`activeSchema`), since which fields exist depends on which schema a
// given row belongs to — that's the one place activeSchema is still needed.
//
// Row detail, entity links, and saved views (#2699): clicking a row opens the same
// RelationDetailPopover used elsewhere for typed relations (graph/topology views); "In"/"Out" cells
// link out to the entity detail screen via EntityNavigationLink, same as RelationRecordList.tsx.
// Saved views reuse the entity browser's SaveViewDialog and useSavedViews hooks as-is — relation-rooted
// saved views persist the canonical query plus the selected table/graph mode.
export const RelationBrowser = ({ workspaceId }: { workspaceId: string }) => {
  const search = useSearch({ strict: false });
  const view: RelationBrowserView = search.viewMode === 'graph' ? 'graph' : 'table';
  const edgeLabelFieldId = search.edgeLabelFieldId ?? RELATION_GRAPH_TYPE_LABEL;
  const edgeColorFieldId = search.edgeColorFieldId ?? RELATION_GRAPH_TYPE_LABEL;
  const relationGraphMode = search.relationGraphMode ?? undefined;
  const configuredTableFieldIds = useMemo(
    () => parseRelationTableFieldIdsFromSearch({ tableFieldIds: search.tableFieldIds }),
    [search.tableFieldIds]
  );
  const {
    relationSchemas,
    entitySchemas,
    enums,
    conditions,
    relationQuery,
    setRelationQuery,
    activeSchema,
    relations,
    total,
    isLoading,
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    pageIndex,
    pageSize
  } = useRelationBrowserData(workspaceId, view);
  const { data: owners = [] } = useTeams(workspaceId);
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceId);
  const navigate = useNavigate();
  const { permissions } = useWorkspaceContext();

  const [detail, setDetail] = useState<{ relationId: string; x: number; y: number } | null>(null);
  const [isSavingView, setIsSavingView] = useState(false);
  const [editRelationId, setEditRelationId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    relationId: string;
    inEntityId: string;
    outEntityId: string;
    label: string;
  } | null>(null);
  const deleteMutation = useDeleteRelation(workspaceId);

  const { data: savedViews = [] } = useSavedViews(workspaceId, {
    enabled: search.viewId != null || isSavingView
  });
  const createSavedViewMutation = useCreateSavedView(workspaceId);
  const updateSavedViewMutation = useUpdateSavedView(workspaceId);
  const activeSavedView = useMemo(
    () => savedViews.find(view => view.id === search.viewId) ?? null,
    [savedViews, search.viewId]
  );

  const setView = useCallback(
    (next: RelationBrowserView) => {
      navigate({
        to: '/$workspaceSlug/entities/relations',
        params: { workspaceSlug: workspaceId },
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          viewMode: next === 'table' ? undefined : next,
          viewId: undefined
        })
      });
    },
    [navigate, workspaceId]
  );

  const setEdgeLabelFieldId = useCallback(
    (next: string) => {
      navigate({
        to: '/$workspaceSlug/entities/relations',
        params: { workspaceSlug: workspaceId },
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          edgeLabelFieldId: next === RELATION_GRAPH_TYPE_LABEL ? undefined : next
        })
      });
    },
    [navigate, workspaceId]
  );

  const setEdgeColorFieldId = useCallback(
    (next: string) => {
      navigate({
        to: '/$workspaceSlug/entities/relations',
        params: { workspaceSlug: workspaceId },
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          edgeColorFieldId: next === RELATION_GRAPH_TYPE_LABEL ? undefined : next
        })
      });
    },
    [navigate, workspaceId]
  );

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportRelationsToCSV(
        workspaceId,
        buildRelationQueryFromFilters(conditions)
      );
      downloadBlob(blob, `relations-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Relation export failed:', error);
      alert('Failed to export relations. Please try again.');
    }
  }, [conditions, workspaceId]);

  const handleImport = useCallback(() => {
    navigate({
      to: '/$workspaceSlug/entities/relations/import',
      params: { workspaceSlug: workspaceId }
    });
  }, [navigate, workspaceId]);

  // A saved view's config.table.fieldIds (curated columns, possibly including `_projection:`
  // aliases from the query's own `projections`) takes precedence when set; otherwise every field
  // on the active relation schema shows, as before.
  const fieldIds = configuredTableFieldIds ?? activeSchema?.fields.map(field => field.id) ?? [];
  const columnCount = 7 + fieldIds.length;
  const fieldLabelById = (fieldId: string): string =>
    fieldId.startsWith(PROJECTION_FIELD_PREFIX)
      ? fieldId.slice(PROJECTION_FIELD_PREFIX.length)
      : (activeSchema?.fields.find(field => field.id === fieldId)?.name ?? fieldId);
  const getFieldValue = (relation: (typeof relations)[number], fieldId: string): unknown =>
    fieldId.startsWith(PROJECTION_FIELD_PREFIX)
      ? (relation._projections as Record<string, unknown> | undefined)?.[
          fieldId.slice(PROJECTION_FIELD_PREFIX.length)
        ]
      : relation[fieldId];
  const fieldTypeById = useMemo(
    () => new Map((activeSchema?.fields ?? []).map(field => [field.id, field.type])),
    [activeSchema]
  );
  // entityRelation-valued columns (e.g. a Data Flow's carried Data Entities) store raw entity ids
  // — resolve them to names up front so the table can render a plain "A, B, C" list rather than a
  // JSON array of uuids.
  const entityRelationFieldIds = useMemo(
    () =>
      (activeSchema?.fields ?? [])
        .filter(field => field.type === 'entityRelation')
        .map(field => field.id),
    [activeSchema]
  );
  const referenceIds = useMemo(
    () =>
      entityRelationFieldIds.length
        ? (relations ?? []).flatMap(relation =>
            entityRelationFieldIds.flatMap(fieldId => relationIds(relation[fieldId]))
          )
        : [],
    [relations, entityRelationFieldIds]
  );
  const referenceLookup = useEntitiesByIds(workspaceId, referenceIds);

  const comparators: Record<
    string,
    (a: (typeof relations)[number], b: (typeof relations)[number]) => number
  > = {
    _in: (a, b) => a._in.name.localeCompare(b._in.name),
    _out: (a, b) => a._out.name.localeCompare(b._out.name),
    _schema: (a, b) => a._schema.name.localeCompare(b._schema.name),
    _owner: (a, b) => compareFieldValues(a._owner?.name ?? null, b._owner?.name ?? null),
    _lifecycle: (a, b) =>
      compareFieldValues(a._lifecycle?.name ?? null, b._lifecycle?.name ?? null),
    _updatedAt: (a, b) => a._updatedAt.localeCompare(b._updatedAt)
  };
  for (const fieldId of fieldIds) {
    comparators[fieldId] = (a, b) =>
      compareFieldValues(getFieldValue(a, fieldId), getFieldValue(b, fieldId));
  }
  const { sorted, sort, toggleSort } = useTableSort(relations, comparators);

  const handleSaveView = async (
    name: string,
    description: string,
    _scope: unknown,
    isAdminView: boolean
  ) => {
    try {
      await createSavedViewMutation.mutateAsync(
        buildRelationSavedViewPayload({
          name,
          description,
          isAdminView,
          viewMode: view,
          conditions,
          edgeLabelFieldId,
          edgeColorFieldId
        })
      );
    } catch {
      // Error handling is done by TanStack Query
    }
  };

  const handleUpdateSavedView = async () => {
    if (!permissions.canManageViews || activeSavedView == null) return;
    const payload = buildRelationSavedViewPayload({
      name: activeSavedView.name,
      description: activeSavedView.description ?? '',
      isAdminView: activeSavedView.isAdminView,
      viewMode: view,
      conditions,
      edgeLabelFieldId,
      edgeColorFieldId
    });
    try {
      await updateSavedViewMutation.mutateAsync({
        id: activeSavedView.id,
        body: { viewMode: view, filters: payload.filters, config: payload.config }
      });
    } catch {
      // Error handling is done by TanStack Query
    }
  };

  const menuItems: MenuItem[] = [];
  if (permissions.canManageViews) {
    if (activeSavedView != null) {
      menuItems.push({
        label: `Save View (${activeSavedView.name})`,
        icon: <TbCheck size={14} />,
        onClick: handleUpdateSavedView
      });
    }
    menuItems.push({
      label: 'Save View As...',
      icon: <TbCopy size={14} />,
      onClick: () => setIsSavingView(true)
    });
  }

  menuItems.push({
    label: 'Export CSV',
    icon: <TbDownload size={14} />,
    onClick: handleExport
  });
  if (permissions.canCreateEntities) {
    menuItems.push({
      label: 'Import CSV',
      icon: <TbUpload size={14} />,
      onClick: handleImport
    });
  }

  return (
    <div className={`${styles.screen} ${view === 'graph' ? styles.graphMode : ''}`}>
      <div className={styles.header}>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () =>
                navigate({ to: '/$workspaceSlug', params: { workspaceSlug: workspaceId } })
            }
          ]}
          title={activeSavedView?.name ?? 'All Relations'}
          chips={
            !isLoading && (
              <span data-testid="relation-browser-count" className={styles.count}>
                {total}
              </span>
            )
          }
          description={
            activeSavedView?.description ||
            'Browse and filter typed relation instances across the workspace.'
          }
          menu={
            menuItems.length > 0 && (
              <DropdownMenu
                trigger={
                  <Button aria-label="Relation browser actions" icon={<TbDots size={14} />} />
                }
                items={menuItems}
              />
            )
          }
        />
      </div>

      <div className={filterStyles.toolbar}>
        <RelationQueryModeControls
          workspaceId={workspaceId}
          relationQuery={relationQuery}
          setRelationQuery={setRelationQuery}
          relationSchemas={relationSchemas}
          entitySchemas={entitySchemas}
          enums={enums}
          owners={owners}
          lifecycleStates={lifecycleStates}
        />
        <div style={{ marginLeft: 'auto' }}>
          <FilterDropdown
            label="View"
            value={view}
            onChange={value => setView((value as RelationBrowserView) ?? 'table')}
            options={[
              { value: 'table', label: 'Table' },
              { value: 'graph', label: 'Graph' }
            ]}
          />
        </div>
      </div>

      {view === 'table' ? (
        <Table.Root scroll stickyHeader>
          <Table.Head>
            <Table.Row>
              <Table.SortableHeaderCell
                sortKey="_in"
                sort={sort}
                onSort={toggleSort}
                style={{ minWidth: 200 }}
              >
                In
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell
                sortKey="_out"
                sort={sort}
                onSort={toggleSort}
                style={{ minWidth: 200 }}
              >
                Out
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="_schema" sort={sort} onSort={toggleSort}>
                Type
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="_owner" sort={sort} onSort={toggleSort}>
                Owner
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="_lifecycle" sort={sort} onSort={toggleSort}>
                Lifecycle
              </Table.SortableHeaderCell>
              {fieldIds.map(fieldId => (
                <Table.SortableHeaderCell
                  key={fieldId}
                  sortKey={fieldId}
                  sort={sort}
                  onSort={toggleSort}
                >
                  {fieldLabelById(fieldId)}
                </Table.SortableHeaderCell>
              ))}
              <Table.SortableHeaderCell sortKey="_updatedAt" sort={sort} onSort={toggleSort}>
                Updated
              </Table.SortableHeaderCell>
              <Table.HeaderCell aria-label="Actions" style={{ width: 40 }} />
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sorted.length === 0 ? (
              <Table.EmptyRow colSpan={columnCount}>
                {isLoading ? 'Loading…' : 'No relation instances found.'}
              </Table.EmptyRow>
            ) : (
              sorted.map(relation => (
                <Table.Row
                  key={relation._uid}
                  onClick={e =>
                    setDetail({ relationId: relation._uid, x: e.clientX, y: e.clientY })
                  }
                >
                  <Table.Cell>
                    <EntityNavigationLink
                      publicId={relation._in.id}
                      className={styles.entityLink}
                      onClick={e => e.stopPropagation()}
                    >
                      {relation._in.name}
                    </EntityNavigationLink>
                  </Table.Cell>
                  <Table.Cell>
                    <EntityNavigationLink
                      publicId={relation._out.id}
                      className={styles.entityLink}
                      onClick={e => e.stopPropagation()}
                    >
                      {relation._out.name}
                    </EntityNavigationLink>
                  </Table.Cell>
                  <Table.Cell>{relation._schema.name}</Table.Cell>
                  <Table.Cell>{relation._owner?.name ?? ''}</Table.Cell>
                  <Table.Cell>{relation._lifecycle?.name ?? ''}</Table.Cell>
                  {fieldIds.map(fieldId => (
                    <Table.Cell key={fieldId}>
                      {formatFieldValue(
                        getFieldValue(relation, fieldId),
                        fieldTypeById.get(fieldId),
                        referenceLookup
                      )}
                    </Table.Cell>
                  ))}
                  <Table.Cell>{new Date(relation._updatedAt).toLocaleString()}</Table.Cell>
                  <Table.Cell interactive>
                    {(relation.canEdit || relation.canDelete) && (
                      <DropdownMenu
                        trigger={
                          <Button
                            variant="ghost"
                            aria-label="Relation actions"
                            icon={<TbDots size={14} />}
                          />
                        }
                        items={[
                          ...(relation.canEdit
                            ? [
                                {
                                  label: 'Edit',
                                  icon: <TbPencil size={14} />,
                                  onClick: () => setEditRelationId(relation._uid)
                                }
                              ]
                            : []),
                          ...(relation.canDelete
                            ? [
                                {
                                  label: 'Delete',
                                  icon: <TbTrash size={14} />,
                                  danger: true,
                                  onClick: () =>
                                    setDeleteTarget({
                                      relationId: relation._uid,
                                      inEntityId: relation._in.id,
                                      outEntityId: relation._out.id,
                                      label: `${relation._in.name} → ${relation._out.name}`
                                    })
                                }
                              ]
                            : [])
                        ]}
                      />
                    )}
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      ) : (
        <div className={styles.graphContainer}>
          <RelationGraphView
            workspaceId={workspaceId}
            relations={relations}
            relationSchemas={relationSchemas}
            entitySchemas={entitySchemas}
            isLoading={isLoading}
            edgeLabelFieldId={edgeLabelFieldId}
            onEdgeLabelFieldIdChange={setEdgeLabelFieldId}
            edgeColorFieldId={edgeColorFieldId}
            onEdgeColorFieldIdChange={setEdgeColorFieldId}
            typedRelationMode={relationGraphMode}
            onEntityClick={entityId =>
              navigate(entityDetailRoute(workspaceId, asEntityPublicId(entityId)))
            }
          />
        </div>
      )}

      {view === 'table' && (
        <div className={filterStyles.pagination}>
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
              disabled={pageIndex * pageSize + relations.length >= total}
              onClick={goToNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {detail && (
        <RelationDetailPopover
          workspaceId={workspaceId}
          relationId={detail.relationId}
          x={detail.x}
          y={detail.y}
          onClose={() => setDetail(null)}
        />
      )}

      <SaveViewDialog
        open={isSavingView}
        onClose={() => setIsSavingView(false)}
        onSave={handleSaveView}
        showAdminOption={permissions.canManageAdminViews}
      />

      <RelationEditDialog
        open={editRelationId != null}
        onClose={() => setEditRelationId(null)}
        workspaceId={workspaceId}
        relationId={editRelationId}
      />

      <DeleteConfirmationDialog
        open={deleteTarget != null}
        title="Delete relation?"
        message={
          <>
            The relation <b>{deleteTarget?.label}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete relation"
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({
              relationId: deleteTarget.relationId,
              inEntityId: deleteTarget.inEntityId,
              outEntityId: deleteTarget.outEntityId
            });
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const compareFieldValues = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
};
