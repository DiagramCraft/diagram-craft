import { TbDots } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { StatusChip } from '../../../components/StatusChip';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/api';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  entityMenuItems,
  entityName,
  type EntityBrowserBaseViewProps,
  projectEntityMenuItems
} from './entityBrowserViewShared';
import { formatDateValue } from './entityBrowserState';
import styles from '../EntityBrowserScreen.module.css';

type DateField = Extract<EntitySchema['fields'][number], { type: 'date' }>;

export type TableViewProps = EntityBrowserBaseViewProps & {
  activeDateField?: DateField | null;
  selectedIds?: Set<string>;
  onSelectAll?: () => void;
  onSelectRow?: (uid: string) => void;
};

const CompletenessCell = ({ value }: { value: number | null }) => {
  if (value == null) return <span className="dim">—</span>;
  const barColor = value <= 75 ? '#f59e0b' : '#22c55e';

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          display: 'inline-block',
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'var(--cmp-border)',
          overflow: 'hidden'
        }}
      >
        <span
          style={{ display: 'block', width: `${value}%`, height: '100%', background: barColor }}
        />
      </span>
      <span className="dim" style={{ fontSize: 11 }}>
        {value}%
      </span>
    </span>
  );
};

export const TableView = ({
  rows,
  schemaMap,
  activeDateField,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates,
  projectContext,
  selectedIds,
  onSelectAll,
  onSelectRow,
  readOnly
}: TableViewProps) => {
  const allSelected = !readOnly && rows.length > 0 && selectedIds?.size === rows.length;
  const someSelected =
    !readOnly && (selectedIds?.size ?? 0) > 0 && (selectedIds?.size ?? 0) < rows.length;

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
            <th>Owner</th>
            <th>Status</th>
            {projectContext && <th>Role</th>}
            {activeDateField && <th>{activeDateField.name}</th>}
            <th style={{ width: 80 }}>NS</th>
            <th style={{ width: 80 }} />
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
                      {entity._description && (
                        <div className={styles.tableNameSub}>{entity._description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>{schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}</td>
                <td>
                  <span className="dim">{entity._owner?.name ?? '—'}</span>
                </td>
                <td>
                  {entity._lifecycle && (
                    <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
                  )}
                </td>
                {projectContext && (
                  <td>
                    {entity._projectLink?.entityType?.name ? (
                      <Chip
                        tone="ghost"
                        dot={
                          entity._projectLink.entityType.id
                            ? projectContext.entityTypeColorMap.get(entity._projectLink.entityType.id)
                            : undefined
                        }
                      >
                        {entity._projectLink.entityType.name}
                      </Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                )}
                {activeDateField && (
                  <td>
                    <span className="dim">{formatDateValue(entity[activeDateField.id])}</span>
                  </td>
                )}
                <td>
                  <span className="dim">{entity._namespace}</span>
                </td>
                <td>
                  <CompletenessCell value={entity._completeness} />
                </td>
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
