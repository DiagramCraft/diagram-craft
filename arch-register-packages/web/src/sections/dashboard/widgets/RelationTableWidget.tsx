import { useMemo, useState } from 'react';
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
  applyRelationFacetFilters,
  buildRelationQueryText,
  compareRelationValues,
  formatRelationFieldValue,
  resolveRelationTableColumns,
  type RelationTableColumn,
  relationFacetFilterSchema
} from './relationTableLogic';
import { RelationDrawer } from '../../relations/RelationDrawer';
import styles from './RelationTableWidget.module.css';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { RELATION_TABLE_META_COLUMNS } from './relationTableLogic';
import configFormStyles from '../WidgetConfigDialog.module.css';
import { z } from 'zod';
import { withInitial } from '../../markdown/mdx-components/configSchema';

export const relationTableWidgetConfigSchema = z.object({
  /** Name of the relation schema whose instances are listed. */
  relationSchemaName: withInitial(z.string().min(1), ''),
  /** Optional entity-query DSL filter, AND-ed with the schema; may reference sidebar `$variables`. */
  filter: z.string().optional(),
  /** Multi-select filters on relation fields (ids or names), e.g. `values: ['$protocols']` bound to
   *  a `facets` sidebar; empty `values` means no constraint. */
  facetFilters: z.array(relationFacetFilterSchema).optional(),
  /** Columns after the Flow (In → Out) column: relation field ids/names, or `_owner`, `_lifecycle`, `_updatedAt`. */
  fieldIds: withInitial(z.array(z.string()), []),
  /** Initial sort column (a `fieldIds` entry, or `_in`/`_out`); a header click re-sorts locally. */
  sort: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  limit: withInitial(z.number().positive(), 100),
  /** Clicking a row opens a detail drawer for that relation. Default off. */
  rowDrawer: z.boolean().optional()
});

export type RelationTableWidgetConfig = z.infer<typeof relationTableWidgetConfigSchema>;

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

  const selected = sorted.find(relation => relation._uid === selectedId);

  return (
    <>
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
              <Table.Row
                key={relation._uid}
                onClick={config.rowDrawer ? () => setSelectedId(relation._uid) : undefined}
              >
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

export const RelationTableConfigForm = ({
  config,
  onChange
}: {
  config: RelationTableWidgetConfig;
  onChange: (config: RelationTableWidgetConfig) => void;
}) => {
  const { relationSchemas } = useWorkspaceContext();
  const schema = relationSchemas.find(candidate => candidate.name === config.relationSchemaName);
  const options = [
    ...(schema?.fields.map(field => ({ id: field.id, label: field.name })) ?? []),
    ...Object.entries(RELATION_TABLE_META_COLUMNS).map(([id, label]) => ({ id, label }))
  ];
  const isSelected = (id: string, label: string) =>
    config.fieldIds.includes(id) || config.fieldIds.includes(label);
  const toggle = (id: string, label: string) =>
    onChange({
      ...config,
      fieldIds: isSelected(id, label)
        ? config.fieldIds.filter(candidate => candidate !== id && candidate !== label)
        : [...config.fieldIds, id]
    });

  return (
    <>
      <DialogSection label="Relation type" required>
        <select
          className={configFormStyles.labelInput}
          value={config.relationSchemaName}
          onChange={event =>
            onChange({ ...config, relationSchemaName: event.currentTarget.value, fieldIds: [] })
          }
        >
          <option value="">Select a relation type…</option>
          {relationSchemas.map(candidate => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Columns" required={false}>
        <div className={configFormStyles.options}>
          {options.map(option => (
            <label key={option.id} className={configFormStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={isSelected(option.id, option.label)}
                onChange={() => toggle(option.id, option.label)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Filter" required={false}>
        <input
          type="text"
          className={configFormStyles.labelInput}
          value={config.filter ?? ''}
          placeholder='e.g. data_classification in ("sensitive", "highly-sensitive")'
          onChange={event => {
            const value = event.currentTarget.value;
            onChange({ ...config, filter: value.trim() === '' ? undefined : value });
          }}
        />
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.checkboxRow}>
            <input
              type="checkbox"
              checked={config.rowDrawer === true}
              onChange={event =>
                onChange({ ...config, rowDrawer: event.currentTarget.checked || undefined })
              }
            />
            <span>Open a detail drawer when a row is clicked</span>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Max rows</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                min={1}
                max={500}
                className={configFormStyles.labelInput}
                value={config.limit}
                onChange={event =>
                  onChange({
                    ...config,
                    limit: Math.max(1, Number(event.currentTarget.value) || 1)
                  })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};

export const RELATION_TABLE_TYPE = 'RelationTable' as const;
