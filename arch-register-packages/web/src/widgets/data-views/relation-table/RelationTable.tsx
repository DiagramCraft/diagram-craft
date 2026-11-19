import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type RelationRecord } from '@arch-register/api-types/relationContract';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { DataTable, type DataTableColumn } from '../../../components/table/DataTable';
import { useTableSort } from '../../../components/table/useTableSort';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { useRelationsQuery } from '../../../hooks/useRelations';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { orpcClient } from '../../../lib/orpcClient';
import { relationIds } from '../../../lib/entityEditState';
import { formatDateTime } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import {
  applyRelationFacetFilters,
  buildRelationQueryText,
  compareRelationValues,
  formatRelationFieldValue,
  resolveRelationTableColumns,
  type RelationTableColumn
} from './relationTableLogic';
import { useWidgetFramed } from '../../shared/dashboard/WidgetFramed';
import { RelationDrawer } from '../../../sections/relations/RelationDrawer';
import styles from './RelationTable.module.css';
import { RelationTableWidgetConfig } from './types';

const cellSortValue = (
  relation: RelationRecord,
  column: RelationTableColumn
): string | number | null => {
  if (column.kind === 'meta') {
    if (column.id === '_owner') return relation._owner?.name ?? null;
    if (column.id === '_lifecycle') return relation._lifecycle?.name ?? null;
    return relation._updatedAt;
  }
  const value = relation[column.field.id];
  if (column.field.type === 'number' && typeof value === 'number') return value;
  return formatRelationFieldValue(column.field, value) || null;
};

export const RelationTableWidget = ({ config }: { config: RelationTableWidgetConfig }) => {
  const { workspaceSlug, relationSchemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const framed = useWidgetFramed();
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const schema = relationSchemas.find(candidate => candidate.name === config.relationSchemaName);
  const queryText = buildRelationQueryText(config.relationSchemaName, config.filter);
  const parsed = useQuery({
    queryKey: ['relation-table', 'parse', workspaceSlug, queryText],
    queryFn: () =>
      orpcClient.entityQueryText.parseText({
        params: { workspace: workspaceSlug },
        query: { text: queryText }
      }),
    enabled: schema != null
  });
  const relationQuery = useMemo(
    () =>
      parsed.data?.ok === true
        ? applyRelationFacetFilters(parsed.data.query, schema, config.facetFilters)
        : null,
    [parsed.data, schema, config.facetFilters]
  );
  const relations = useRelationsQuery(
    workspaceSlug,
    relationQuery,
    { view: 'full', limit: config.limit },
    { enabled: relationQuery != null }
  );

  const columns = useMemo(
    () => resolveRelationTableColumns(config.fieldIds, schema),
    [config.fieldIds, schema]
  );
  const carriedIds = useMemo(
    () =>
      columns.flatMap(column =>
        column.kind === 'field' && column.field.type === 'entityRelation'
          ? relations.data.flatMap(relation => relationIds(relation[column.field.id]))
          : []
      ),
    [columns, relations.data]
  );
  const carried = useEntitiesByIds(workspaceSlug, carriedIds);

  const comparators = useMemo(() => {
    const result: Record<string, (a: RelationRecord, b: RelationRecord) => number> = {
      _in: (a, b) => a._in.name.localeCompare(b._in.name),
      _out: (a, b) => a._out.name.localeCompare(b._out.name)
    };
    for (const column of columns) {
      result[column.id] = (a, b) =>
        compareRelationValues(cellSortValue(a, column), cellSortValue(b, column));
    }
    return result;
  }, [columns]);
  const { sorted, sort, toggleSort } = useTableSort(
    relations.data,
    comparators,
    config.sort ? { key: config.sort, dir: config.sortDir ?? 'asc' } : undefined
  );

  if (!schema) {
    return (
      <EmptyState title={`Relation schema '${config.relationSchemaName}' not found`} compact />
    );
  }
  if (parsed.data?.ok === false) {
    return <EmptyState title="This widget's filter is not a valid query." compact />;
  }
  if (parsed.isLoading || relations.isLoading) return <LoadingState text="Loading…" size="sm" />;

  const renderCell = (relation: RelationRecord, column: RelationTableColumn) => {
    if (column.kind === 'meta') {
      if (column.id === '_owner') return relation._owner?.name ?? '';
      if (column.id === '_lifecycle') return relation._lifecycle?.name ?? '';
      return formatDateTime(relation._updatedAt, '—', dateTimeFormatPreference);
    }
    if (column.field.type === 'entityRelation') {
      const ids = relationIds(relation[column.field.id]);
      if (ids.length === 0) return <span className={styles.empty}>—</span>;
      return (
        <div className={styles.chips}>
          {ids.map(id => {
            const ref = carried.get(id);
            return (
              <button
                key={id}
                type="button"
                className={styles.chipButton}
                onClick={() => openEntityDrawer(ref?.publicId ?? id)}
              >
                <Chip tone="ghost">{ref?.name ?? id}</Chip>
              </button>
            );
          })}
        </div>
      );
    }
    return formatRelationFieldValue(column.field, relation[column.field.id]) || '—';
  };

  const endpointLink = (endpoint: { id: string; name: string }) => (
    <button type="button" className={styles.link} onClick={() => openEntityDrawer(endpoint.id)}>
      {endpoint.name}
    </button>
  );

  const selected = sorted.find(relation => relation._uid === selectedId);

  const tableColumns: DataTableColumn<RelationRecord>[] = [
    {
      id: '_in',
      header: 'Source',
      size: 200,
      minSize: 100,
      meta: { sortable: true, label: 'Source', interactive: true },
      cell: ({ row }) => endpointLink(row.original._in)
    },
    {
      id: '_out',
      header: 'Destination',
      size: 200,
      minSize: 100,
      meta: { sortable: true, label: 'Destination', interactive: true },
      cell: ({ row }) => endpointLink(row.original._out)
    },
    ...columns.map(
      (column): DataTableColumn<RelationRecord> => ({
        id: column.id,
        header: column.label,
        minSize: 80,
        meta: {
          sortable: true,
          label: column.label,
          interactive: column.kind === 'field' && column.field.type === 'entityRelation'
        },
        cell: ({ row }) => renderCell(row.original, column)
      })
    )
  ];

  return (
    <>
      <DataTable
        // Remount when the column set changes so local widths don't leak between column sets.
        key={columns.map(column => column.id).join('|')}
        scroll
        stickyHeader
        resizable
        bordered={!framed}
        columns={tableColumns}
        data={sorted}
        getRowId={relation => relation._uid}
        sort={sort}
        onSort={toggleSort}
        onRowClick={config.rowDrawer ? relation => setSelectedId(relation._uid) : undefined}
        emptyState="No matching relations."
      />
      {selected && (
        <RelationDrawer
          workspaceSlug={workspaceSlug}
          relation={selected}
          relationSchema={schema}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
};
