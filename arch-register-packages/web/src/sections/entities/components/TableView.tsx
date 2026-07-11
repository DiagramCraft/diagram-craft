import { TbDots } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  entityMenuItems,
  entityName,
  type EntityBrowserBaseViewProps,
  projectEntityMenuItems
} from './entityBrowserViewShared';
import styles from '../EntityBrowserScreen.module.css';
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
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {!readOnly && (
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onSelectAll}
                />
              </th>
            )}
            <th style={{ minWidth: 200 }}>Name</th>
            <th>Type</th>
            {columns.filter(c => c.id !== '_description').map(c => <th key={c.id}>{c.label}</th>)}
            {activeDateField && !fieldIds.includes(activeDateField.id) && <th>{activeDateField.name}</th>}
            {!readOnly && <th style={{ width: 28 }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map(entity => {
            const schemaEntry = schemaMap.get(entity._schema.id);
            const menuItems = readOnly
              ? []
              : [
                  ...entityMenuItems(entity, onClone, onDelete),
                  ...projectEntityMenuItems(entity, projectContext)
                ];

            return (
              <tr
                key={entity._uid}
                aria-label={`Entity row: ${entityName(entity)}`}
                className={selectedIds?.has(entity._uid) ? styles.tableRowSelected : undefined}
                onClick={() => onEntityClick(entity._publicId)}
              >
                {!readOnly && (
                  <td onClick={ev => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds?.has(entity._uid) ?? false}
                      onChange={() => onSelectRow?.(entity._uid)}
                    />
                  </td>
                )}
                <td>
                  <div className={styles.tableName}>
                    {schemaEntry && (
                      <TypeBadge
                        color={resolveSchemaColor(schemaEntry.schema, schemaEntry.index)}
                        name={schemaEntry.schema.name}
                        icon={schemaEntry.schema.icon}
                        size={18}
                      />
                    )}
                    <div>
                      <div
                        className={styles.tableNameMain}
                        style={
                          projectContext && entity._projectLink?.linked === false
                            ? { color: 'var(--base-fg-more-dim)' }
                            : undefined
                        }
                      >
                        {entityName(entity)}
                      </div>
                      {fieldIds.includes('_description') && entity._description && (
                        <div className={styles.tableNameSub}>{entity._description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>{schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}</td>
                {columns.filter(c => c.id !== '_description').map(column => {
                  const field = findEntityDisplayField(column.id, entity, schemaMap, displayFields) ?? column;
                  return <td key={column.id}><span className="dim">{formatEntityDisplayValue(entity, field) ?? '—'}</span></td>;
                })}
                {activeDateField && !fieldIds.includes(activeDateField.id) && (
                  <td>
                    <span className="dim">{formatDate(entity[activeDateField.id])}</span>
                  </td>
                )}
                {!readOnly && (
                  <td onClick={ev => ev.stopPropagation()}>
                    {menuItems.length > 0 && (
                      <DropdownMenu
                        trigger={
                          <button type="button" className={styles.dotsBtn}>
                            <TbDots size={14} />
                          </button>
                        }
                        items={menuItems}
                      />
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
