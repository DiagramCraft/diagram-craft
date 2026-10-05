import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { Table } from '../../../components/table/Table';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  entityMenuItems,
  entityName,
  type EntityBrowserBaseViewProps,
  projectEntityMenuItems
} from './entityBrowserViewShared';
import { nextSort, parseSort } from './entityBrowserSort';
import { formatDate } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import {
  filterDisplayFieldIdsForContext,
  findEntityDisplayField,
  formatEntityDisplayValue,
  getDisplayFieldIds,
  isNumericDisplayField,
  type EntityDisplayField
} from './entityDisplayFields';
import { isEntityInProject } from './entityBrowserState';
import styles from './TableView.module.css';

type DateField = Extract<EntitySchema['fields'][number], { type: 'date' }>;

export type TableViewProps = EntityBrowserBaseViewProps & {
  activeDateField?: DateField | null;
  selectedIds?: Set<string>;
  onSelectAll?: () => void;
  onSelectRow?: (uid: string) => void;
  config: unknown;
  displayFields: EntityDisplayField[];
  /** Omit the Type column, e.g. when the browser is scoped to a single schema. */
  hideTypeColumn?: boolean;
  /** Current `sort` string and its setter; when both are given, column headers are sortable. */
  sort?: string;
  onSortChange?: (sort: string) => void;
};

export const TableView = ({
  rows,
  schemaMap,
  activeDateField,
  onEntityClick,
  onDelete,
  onClone,
  onManageCollections,
  onMerge,
  projectContext,
  selectedIds,
  onSelectAll,
  onSelectRow,
  readOnly,
  config,
  displayFields,
  hideTypeColumn,
  sort,
  onSortChange
}: TableViewProps) => {
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const allSelected = !readOnly && rows.length > 0 && selectedIds?.size === rows.length;
  const someSelected =
    !readOnly && (selectedIds?.size ?? 0) > 0 && (selectedIds?.size ?? 0) < rows.length;
  const fieldIds = filterDisplayFieldIdsForContext(
    getDisplayFieldIds('table', config),
    projectContext != null
  );
  const columns = fieldIds.map(
    id => displayFields.find(field => field.id === id) ?? { id, label: id, group: 'Fields' }
  );

  const sortState = sort !== undefined ? parseSort(sort) : null;
  const toggleSort =
    onSortChange && sort !== undefined ? (key: string) => onSortChange(nextSort(sort, key)) : null;
  const headerCell = (
    key: string,
    label: ReactNode,
    props: { numeric?: boolean; style?: CSSProperties } = {}
  ) =>
    toggleSort ? (
      <Table.SortableHeaderCell sortKey={key} sort={sortState} onSort={toggleSort} {...props}>
        {label}
      </Table.SortableHeaderCell>
    ) : (
      <Table.HeaderCell {...props}>{label}</Table.HeaderCell>
    );

  return (
    <Table.Root scroll>
      <Table.Head>
        <Table.Row>
          {!readOnly && (
            <Table.CheckboxCell
              as="th"
              aria-label="Select all"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={onSelectAll}
            />
          )}
          {headerCell('_name', 'Name', { style: { minWidth: 200 } })}
          {!hideTypeColumn && <Table.HeaderCell>Type</Table.HeaderCell>}
          {columns
            .filter(c => c.id !== '_description')
            .map(c => (
              <Fragment key={c.id}>
                {headerCell(c.id, c.label, { numeric: isNumericDisplayField(c) })}
              </Fragment>
            ))}
          {activeDateField &&
            !fieldIds.includes(activeDateField.id) &&
            headerCell(activeDateField.id, activeDateField.name)}
          {!readOnly && <Table.HeaderCell style={{ width: 28 }} />}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map(entity => {
          const schemaEntry = schemaMap.get(entity._schema.id);
          const activeDateValue = activeDateField
            ? (entity as unknown as Record<string, unknown>)[activeDateField.id]
            : undefined;
          const menuItems = readOnly
            ? []
            : [
                ...entityMenuItems(entity, onClone, onDelete, onManageCollections, onMerge),
                ...projectEntityMenuItems(entity, projectContext)
              ];

          return (
            <Table.Row
              key={entity._uid}
              aria-label={`Entity row: ${entityName(entity)}`}
              selected={selectedIds?.has(entity._uid)}
              onClick={() => onEntityClick(entity._publicId)}
            >
              {!readOnly && (
                <Table.CheckboxCell
                  aria-label={`Select ${entityName(entity)}`}
                  checked={selectedIds?.has(entity._uid) ?? false}
                  onChange={() => onSelectRow?.(entity._uid)}
                />
              )}
              <Table.NameCell
                icon={
                  schemaEntry && (
                    <TypeBadge
                      color={resolveSchemaColor(schemaEntry.schema, schemaEntry.index)}
                      name={schemaEntry.schema.name}
                      icon={schemaEntry.schema.icon}
                      size={18}
                    />
                  )
                }
                title={
                  <EntityNavigationLink publicId={entity._publicId} className={styles.nameLink}>
                    {entityName(entity)}
                  </EntityNavigationLink>
                }
                titleMuted={
                  projectContext != null && !isEntityInProject(entity, projectContext.project.id)
                }
                subtitle={
                  fieldIds.includes('_description') && entity._description
                    ? entity._description
                    : undefined
                }
              />
              {!hideTypeColumn && (
                <Table.Cell>
                  {schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}
                </Table.Cell>
              )}
              {columns
                .filter(c => c.id !== '_description')
                .map(column => {
                  const field =
                    findEntityDisplayField(column.id, entity, schemaMap, displayFields) ?? column;
                  return (
                    <Table.Cell key={column.id} numeric={isNumericDisplayField(field)}>
                      <span className="dim">
                        {formatEntityDisplayValue(entity, field, dateTimeFormatPreference) ?? '—'}
                      </span>
                    </Table.Cell>
                  );
                })}
              {activeDateField && !fieldIds.includes(activeDateField.id) && (
                <Table.Cell>
                  <span className="dim">
                    {formatDate(
                      Array.isArray(activeDateValue)
                        ? (activeDateValue[0] as string | undefined)
                        : (activeDateValue as string | undefined),
                      '—',
                      dateTimeFormatPreference
                    )}
                  </span>
                </Table.Cell>
              )}
              {!readOnly && (
                <Table.ActionsCell>
                  {menuItems.length > 0 && (
                    <DropdownMenu trigger={<Table.DotsButton />} items={menuItems} />
                  )}
                </Table.ActionsCell>
              )}
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
};
