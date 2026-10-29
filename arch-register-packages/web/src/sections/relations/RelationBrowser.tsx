import { useCallback, useMemo, useState } from 'react';
import { relationLabel } from '../../lib/relationLabel';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  TbCheck,
  TbCopy,
  TbPencil,
  TbTrash,
  TbDownload,
  TbUpload,
  TbAffiliate
} from 'react-icons/tb';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import styles from './RelationBrowser.module.css';
import { ViewControls, ViewControlsSpacer } from '../../components/ViewControls';
import { Chip } from '../../components/Chip';
import { Pagination } from '../../components/Pagination';
import { Title } from '../../components/Title';
import { LabeledSelect } from '../../components/LabeledSelect';
import { Table } from '../../components/table/Table';
import { TypeBadge } from '../../components/TypeBadge';
import { useTableSort } from '../../components/table/useTableSort';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { TitleMenu } from '../../components/TitleMenu';
import { useEntityDrawer } from '../entities/entityDrawer/useEntityDrawer';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useTeams, useLifecycleStates } from '../../hooks/useWorkspaceConfig';
import { useSavedViews, useCreateSavedView, useUpdateSavedView } from '../../hooks/useSavedViews';
import { useDeleteRelation } from '../../hooks/useRelations';
import { useEntitiesByIds } from '../../hooks/useEntities';
import { relationIds } from '../../lib/entityEditState';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { RelationDrawer } from './RelationDrawer';
import { RelationBlastRadiusDialog } from './RelationBlastRadiusDialog';
import { SaveViewDialog } from '../entities/components/EntityBrowser';
import { RelationEditDialog } from '../../dialogs/RelationEditDialog';
import { useRelationBrowserData } from './useRelationBrowserData';
import { RelationQueryModeControls } from './RelationQueryModeControls';
import {
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
// relationBrowserState.ts), so the browser shows relations across every
// schema at once by default, and every relation schema's fields are filterable regardless of Type.
// A "Type" column is always shown; per-schema field *columns* only make sense once the filters
// narrow to exactly one schema (`activeSchema`), since which fields exist depends on which schema a
// given row belongs to — that's the one place activeSchema is still needed.
//
// Row detail, entity links, and saved views (#2699): clicking a row opens the
// RelationDrawer (which links on to the In/Out entities); the graph view still uses the
// RelationDetailPopover for edges.
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
  const entitySchemaById = useMemo(
    () => new Map(entitySchemas.map((schema, index) => [schema.id, { schema, index }])),
    [entitySchemas]
  );
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const { permissions } = useWorkspaceContext();

  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [blastRadiusRelationId, setBlastRadiusRelationId] = useState<string | null>(null);
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
      // The full stored query, not `conditions` - a relationForward/relationBackward traversal or
      // a projection column (#3120) round-trips through `conditions` lossily, so exporting from it
      // would silently apply a different, incomplete filter.
      const blob = await exportRelationsToCSV(workspaceId, relationQuery);
      downloadBlob(blob, `relations-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Relation export failed:', error);
      alert('Failed to export relations. Please try again.');
    }
  }, [relationQuery, workspaceId]);

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
  const columnCount = 6 + fieldIds.length;
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
    _lifecycle: (a, b) => compareFieldValues(a._lifecycle?.name ?? null, b._lifecycle?.name ?? null)
  };
  for (const fieldId of fieldIds) {
    comparators[fieldId] = (a, b) =>
      compareFieldValues(getFieldValue(a, fieldId), getFieldValue(b, fieldId));
  }
  const { sorted, sort, toggleSort, setSort } = useTableSort(relations, comparators);
  const sortValue = sort?.key ?? 'none';
  const handleSortChange = (value: string) =>
    setSort(value === 'none' ? null : { key: value, dir: 'asc' });
  const selectedRelation = relations.find(relation => relation._uid === selectedRelationId);

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
          relationQuery,
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
      relationQuery,
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
            menuItems.length > 0 && <TitleMenu label="Relation browser actions" items={menuItems} />
          }
        />
      </div>

      <ViewControls spaced compactButtons>
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
        <ViewControlsSpacer />
        <div style={{ display: 'flex', gap: 8 }}>
          {view === 'table' && (
            <LabeledSelect
              label="Sort"
              value={sortValue}
              onChange={handleSortChange}
              options={[
                { value: 'none', label: 'Default' },
                { value: '_in', label: 'In' },
                { value: '_out', label: 'Out' },
                { value: '_schema', label: 'Type' }
              ]}
            />
          )}
          <LabeledSelect
            label="View"
            value={view}
            onChange={value => setView((value as RelationBrowserView) ?? 'table')}
            options={[
              { value: 'table', label: 'Table' },
              { value: 'graph', label: 'Graph' }
            ]}
          />
        </div>
      </ViewControls>

      {view === 'table' ? (
        <Table.Root scroll>
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
              <Table.HeaderCell aria-label="Actions" style={{ width: 40 }} />
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sorted.length === 0 ? (
              <Table.EmptyRow colSpan={columnCount}>
                {isLoading ? 'Loading…' : 'No relation instances found.'}
              </Table.EmptyRow>
            ) : (
              sorted.map(relation => {
                const inSchema = entitySchemaById.get(relation._in.schemaId ?? '');
                const outSchema = entitySchemaById.get(relation._out.schemaId ?? '');
                return (
                  <Table.Row
                    key={relation._uid}
                    onClick={() => setSelectedRelationId(relation._uid)}
                  >
                    <Table.Cell>
                      <span className={styles.endpoint}>
                        {inSchema && (
                          <TypeBadge
                            color={resolveSchemaColor(inSchema.schema, inSchema.index)}
                            name={inSchema.schema.name}
                            icon={inSchema.schema.icon}
                            size={18}
                          />
                        )}
                        {relation._in.name}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className={styles.endpoint}>
                        {outSchema && (
                          <TypeBadge
                            color={resolveSchemaColor(outSchema.schema, outSchema.index)}
                            name={outSchema.schema.name}
                            icon={outSchema.schema.icon}
                            size={18}
                          />
                        )}
                        {relation._out.name}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip tone="ghost">{relation._schema.name}</Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="dim">{relation._owner?.name ?? ''}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="dim">{relation._lifecycle?.name ?? ''}</span>
                    </Table.Cell>
                    {fieldIds.map(fieldId => (
                      <Table.Cell key={fieldId}>
                        {formatFieldValue(
                          getFieldValue(relation, fieldId),
                          fieldTypeById.get(fieldId),
                          referenceLookup
                        )}
                      </Table.Cell>
                    ))}
                    <Table.ActionsCell>
                      <DropdownMenu
                        trigger={<Table.DotsButton />}
                        items={[
                          {
                            label: 'View blast radius',
                            icon: <TbAffiliate size={14} />,
                            onClick: () => setBlastRadiusRelationId(relation._uid)
                          },
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
                                      label: relationLabel(relation)
                                    })
                                }
                              ]
                            : [])
                        ]}
                      />
                    </Table.ActionsCell>
                  </Table.Row>
                );
              })
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
            onEntityClick={entityId => openEntityDrawer(entityId)}
          />
        </div>
      )}

      {view === 'table' && (
        <Pagination
          pageSize={pageSize}
          onPageSizeChange={size => handlePageSizeChange(String(size))}
          canGoPrev={pageIndex !== 0}
          canGoNext={pageIndex * pageSize + relations.length < total}
          onPrev={goToPreviousPage}
          onNext={goToNextPage}
        />
      )}

      {selectedRelation && (
        <RelationDrawer
          workspaceSlug={workspaceId}
          relation={selectedRelation}
          relationSchema={relationSchemas.find(schema => schema.id === selectedRelation._schema.id)}
          onClose={() => setSelectedRelationId(null)}
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

      <RelationBlastRadiusDialog
        open={blastRadiusRelationId != null}
        onClose={() => setBlastRadiusRelationId(null)}
        workspaceId={workspaceId}
        relationId={blastRadiusRelationId}
        schemas={entitySchemas}
        lifecycleStates={lifecycleStates}
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
