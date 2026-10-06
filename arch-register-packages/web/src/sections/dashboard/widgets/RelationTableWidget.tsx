import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { useRelationsQuery } from '../../../hooks/useRelations';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { orpcClient } from '../../../lib/orpcClient';
import { relationIds } from '../../../lib/entityEditState';
import { formatDateTime } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import {
  buildRelationQueryText,
  compareRelationValues,
  formatRelationFieldValue,
  resolveRelationTableColumns,
  type RelationTableColumn
} from './relationTableLogic';
import styles from './RelationTableWidget.module.css';

export type RelationTableWidgetConfig = {
  /** Name of the relation schema whose instances are listed. */
  relationSchemaName: string;
  /** Optional entity-query DSL filter, AND-ed with the schema; may reference sidebar `$variables`. */
  filter?: string;
  /** Columns after the Flow (In → Out) column: relation field ids/names, or `_owner`, `_lifecycle`, `_updatedAt`. */
  fieldIds: string[];
  /** Initial sort column (a `fieldIds` entry, or `_in`/`_out`); a header click re-sorts locally. */
  sort?: string;
  sortDir?: 'asc' | 'desc';
  limit: number;
  label?: string;
};

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
  const dateTimeFormatPreference = useDateTimeFormatPreference();

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
  const relationQuery = parsed.data?.ok === true ? parsed.data.query : null;
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
      if (ids.length === 0) return <span className="dim">—</span>;
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

  return (
    <Table.Root scroll stickyHeader bordered={false}>
      <Table.Head>
        <Table.Row>
          <Table.SortableHeaderCell sortKey="_in" sort={sort} onSort={toggleSort}>
            Source
          </Table.SortableHeaderCell>
          <Table.SortableHeaderCell sortKey="_out" sort={sort} onSort={toggleSort}>
            Destination
          </Table.SortableHeaderCell>
          {columns.map(column => (
            <Table.SortableHeaderCell
              key={column.id}
              sortKey={column.id}
              sort={sort}
              onSort={toggleSort}
            >
              {column.label}
            </Table.SortableHeaderCell>
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.length === 0 ? (
          <Table.EmptyRow colSpan={columns.length + 2}>No matching relations.</Table.EmptyRow>
        ) : (
          sorted.map(relation => (
            <Table.Row key={relation._uid}>
              <Table.Cell>{endpointLink(relation._in)}</Table.Cell>
              <Table.Cell>{endpointLink(relation._out)}</Table.Cell>
              {columns.map(column => (
                <Table.Cell key={column.id}>{renderCell(relation, column)}</Table.Cell>
              ))}
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
};
