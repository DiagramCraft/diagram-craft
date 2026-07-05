import { TbDots } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { StatusChip } from '../../../components/StatusChip';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import {
  entityMenuItems,
  entityName,
  type EntityBrowserBaseViewProps,
  projectEntityMenuItems
} from './entityBrowserViewShared';
import styles from '../EntityBrowserScreen.module.css';
import { findEntityDisplayField, formatEntityDisplayValue, getDisplayFieldIds, type EntityDisplayField } from './entityDisplayFields';

type CardsViewProps = EntityBrowserBaseViewProps & { config: unknown; displayFields: EntityDisplayField[] };

export const CardsView = ({
  rows,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates,
  projectContext,
  readOnly, config, displayFields
}: CardsViewProps) => {
  const fieldIds = getDisplayFieldIds('cards', config);
  return (
  <div className={styles.cardGrid}>
    {rows.map(entity => {
      const schemaEntry = schemaMap.get(entity._schema.id);
      const color = schemaEntry
        ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index)
        : 'var(--accent-fg)';
      const menuItems = readOnly
        ? []
        : [
            ...entityMenuItems(entity, onClone, onDelete),
            ...projectEntityMenuItems(entity, projectContext)
          ];

      return (
        <div key={entity._uid} className={styles.card} onClick={() => onEntityClick(entity._publicId)}>
          <span className={styles.cardBar} style={{ background: color }} />
          <div className={styles.cardHead}>
            {schemaEntry && <TypeBadge color={color} name={schemaEntry.schema.name} size={22} />}
            <div className={styles.cardHeadRight}>
              {fieldIds.includes('_lifecycle') && entity._lifecycle && (
                <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
              )}
              {menuItems.length > 0 && (
                <span onClick={ev => ev.stopPropagation()}>
                  <DropdownMenu
                    trigger={
                      <button type="button" className={styles.dotsBtn}>
                        <TbDots size={14} />
                      </button>
                    }
                    items={menuItems}
                  />
                </span>
              )}
            </div>
          </div>
          <div
            className={styles.cardName}
            style={
              projectContext && entity._projectLink?.linked === false
                ? { color: 'var(--base-fg-more-dim)' }
                : undefined
            }
          >
            {entityName(entity)}
          </div>
          {fieldIds.includes('_description') && entity._description && <div className={styles.cardDesc}>{entity._description}</div>}
          <div className={styles.cardMeta}>
            {fieldIds.filter(id => id !== '_description' && id !== '_lifecycle').map(id => {
              const field = findEntityDisplayField(id, entity, schemaMap, displayFields);
              const value = field ? formatEntityDisplayValue(entity, field) : null;
              return value == null ? null : <Chip key={id} tone="ghost">{field!.label}: {value}</Chip>;
            })}
          </div>
        </div>
      );
    })}
  </div>);
};
