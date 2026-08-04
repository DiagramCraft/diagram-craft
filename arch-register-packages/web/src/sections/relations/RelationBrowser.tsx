import { useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFilter } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import styles from './RelationBrowser.module.css';
import filterStyles from '../entities/components/EntityBrowser.module.css';
import { Title } from '../../components/Title';
import { Table } from '../../components/table/Table';
import { useTableSort } from '../../components/table/useTableSort';
import { useFieldGroupAccess } from '../../auth/useFieldGroupAccess';
import { useRelationBrowserData } from './useRelationBrowserData';
import { RelationFilterBuilder } from './RelationFilterBuilder';

// Standalone relation-rooted browser (#2689): lists relation instances via the /relations/query
// endpoint, distinct from the entity-embedded relation tab (EntityRelationsTab/RelationRecordList),
// which stays untouched. Table view only for v1 — no tree/radar/matrix/map/graph/topology, since
// those are entity-semantic views without a relation-rooted equivalent yet.
//
// No separate schema picker (#2698): "type" is just another filter condition (see
// RelationFilterBuilder.tsx/relationBrowserState.ts), so the browser shows relations across every
// schema at once by default, and every relation schema's fields are filterable regardless of Type.
// A "Type" column is always shown; per-schema field *columns* only make sense once the filters
// narrow to exactly one schema (`activeSchema`), since which fields exist depends on which schema a
// given row belongs to — that's the one place activeSchema is still needed.
export const RelationBrowser = ({ workspaceId }: { workspaceId: string }) => {
  const {
    relationSchemas,
    entitySchemas,
    enums,
    conditions,
    setConditions,
    activeSchema,
    relations,
    total,
    isLoading
  } = useRelationBrowserData(workspaceId);
  const getFieldGroupAccess = useFieldGroupAccess(workspaceId);
  const filterPopoverRef = useRef<PopoverActions | null>(null);
  const navigate = useNavigate();

  const fieldIds = activeSchema?.fields.map(field => field.id) ?? [];
  const columnCount = 4 + fieldIds.length;

  const comparators: Record<
    string,
    (a: (typeof relations)[number], b: (typeof relations)[number]) => number
  > = {
    _in: (a, b) => a._in.name.localeCompare(b._in.name),
    _out: (a, b) => a._out.name.localeCompare(b._out.name),
    _schema: (a, b) => a._schema.name.localeCompare(b._schema.name),
    _updatedAt: (a, b) => a._updatedAt.localeCompare(b._updatedAt)
  };
  for (const fieldId of fieldIds) {
    comparators[fieldId] = (a, b) => compareFieldValues(a[fieldId], b[fieldId]);
  }
  const { sorted, sort, toggleSort } = useTableSort(relations, comparators);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () =>
                navigate({ to: '/$workspaceSlug', params: { workspaceSlug: workspaceId } })
            }
          ]}
          title="All Relations"
          chips={
            !isLoading && (
              <span data-testid="relation-browser-count" className={styles.count}>
                {total}
              </span>
            )
          }
          description="Browse and filter typed relation instances across the workspace."
        />
      </div>

      <div className={filterStyles.toolbar}>
        <Popover.Root actionsRef={filterPopoverRef}>
          <Popover.Trigger
            element={
              <Button
                size="sm"
                variant={conditions.length > 0 ? 'primary' : 'secondary'}
                icon={<TbFilter size={12} />}
                aria-label="Filter"
                title="Filter"
              >
                {conditions.length > 0 && (
                  <span className={filterStyles.filterCount}>{conditions.length}</span>
                )}
              </Button>
            }
          />
          <Popover.Content
            sideOffset={4}
            align="start"
            arrow={false}
            closeButton={false}
            className={filterStyles.filterPopover}
          >
            <RelationFilterBuilder
              conditions={conditions}
              onChange={setConditions}
              onClose={() => filterPopoverRef.current?.close()}
              relationSchemas={relationSchemas}
              entitySchemas={entitySchemas}
              enums={enums}
              getFieldGroupAccess={getFieldGroupAccess}
            />
          </Popover.Content>
        </Popover.Root>
      </div>

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
            {fieldIds.map(fieldId => (
              <Table.SortableHeaderCell
                key={fieldId}
                sortKey={fieldId}
                sort={sort}
                onSort={toggleSort}
              >
                {fieldId}
              </Table.SortableHeaderCell>
            ))}
            <Table.SortableHeaderCell sortKey="_updatedAt" sort={sort} onSort={toggleSort}>
              Updated
            </Table.SortableHeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={columnCount}>
              {isLoading ? 'Loading…' : 'No relation instances found.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(relation => (
              <Table.Row key={relation._uid}>
                <Table.Cell>{relation._in.name}</Table.Cell>
                <Table.Cell>{relation._out.name}</Table.Cell>
                <Table.Cell>{relation._schema.name}</Table.Cell>
                {fieldIds.map(fieldId => (
                  <Table.Cell key={fieldId}>{formatFieldValue(relation[fieldId])}</Table.Cell>
                ))}
                <Table.Cell>{new Date(relation._updatedAt).toLocaleString()}</Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
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

const formatFieldValue = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};
