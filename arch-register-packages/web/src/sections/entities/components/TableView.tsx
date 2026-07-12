import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
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
import { formatDate } from '../../../utils/dateFormat';
import { findEntityDisplayField, formatEntityDisplayValue, getDisplayFieldIds, type EntityDisplayField } from './entityDisplayFields';

type DateField = Extract<EntitySchema['fields'][number], { type: 'date' }>;

export type TableViewProps = EntityBrowserBaseViewProps & {
  activeDateField?: DateField | null;
  selectedIds?: Set<string>;
  onSelectAll?: () => void;
  onSelectRow?: (uid: string) => void;
  config: unknown;
  displayFields: EntityDisplayField[];
};

export const TableView = ({
  rows,
  schemaMap,
  activeDateField,
  onEntityClick,
  onDelete,
  onClone,
  projectContext,
  selectedIds,
  onSelectAll,
  onSelectRow,
  readOnly, config, displayFields
}: TableViewProps) => {
  const allSelected = !readOnly && rows.length > 0 && selectedIds?.size === rows.length;
  const someSelected =
    !readOnly && (selectedIds?.size ?? 0) > 0 && (selectedIds?.size ?? 0) < rows.length;
  const fieldIds = getDisplayFieldIds('table', config);
  const columns = fieldIds.map(id => displayFields.find(field => field.id === id) ?? { id, label: id, group: 'Fields' });

  return (
    <Table.Root>
      <Table.Head>
        <tr>
          {!readOnly && (
            <Table.CheckboxCell
              as="th"
              aria-label="Select all"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={onSelectAll}
            />
          )}
          <Table.HeaderCell style={{ minWidth: 200 }}>Name</Table.HeaderCell>
          <Table.HeaderCell>Type</Table.HeaderCell>
          {columns.filter(c => c.id !== '_description').map(c => (
            <Table.HeaderCell key={c.id}>{c.label}</Table.HeaderCell>
          ))}
          {activeDateField && !fieldIds.includes(activeDateField.id) && (
            <Table.HeaderCell>{activeDateField.name}</Table.HeaderCell>
          )}
          {!readOnly && <Table.HeaderCell style={{ width: 28 }} />}
        </tr>
      </Table.Head>
      <Table.Body>
        {rows.map(entity => {
          const schemaEntry = schemaMap.get(entity._schema.id);
          const menuItems = readOnly
            ? []
            : [
                ...entityMenuItems(entity, onClone, onDelete),
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
                title={entityName(entity)}
                titleMuted={projectContext && entity._projectLink?.linked === false}
                subtitle={fieldIds.includes('_description') && entity._description ? entity._description : undefined}
              />
              <Table.Cell>{schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}</Table.Cell>
              {columns.filter(c => c.id !== '_description').map(column => {
                const field = findEntityDisplayField(column.id, entity, schemaMap, displayFields) ?? column;
                return (
                  <Table.Cell key={column.id}>
                    <span className="dim">{formatEntityDisplayValue(entity, field) ?? '—'}</span>
                  </Table.Cell>
                );
              })}
              {activeDateField && !fieldIds.includes(activeDateField.id) && (
                <Table.Cell>
                  <span className="dim">{formatDate(entity[activeDateField.id])}</span>
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
