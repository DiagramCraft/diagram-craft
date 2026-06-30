import { TbDots, TbUsers } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { StatusChip } from '../../../components/StatusChip';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/api';
import {
  entityMenuItems,
  entityName,
  type EntityBrowserBaseViewProps,
  projectEntityMenuItems
} from './entityBrowserViewShared';
import styles from '../EntityBrowserScreen.module.css';

export const CardsView = ({
  rows,
  schemaMap,
  onEntityClick,
  onDelete,
  onClone,
  lifecycleStates,
  projectContext
}: EntityBrowserBaseViewProps) => (
  <div className={styles.cardGrid}>
    {rows.map(entity => {
      const schemaEntry = schemaMap.get(entity._schema.id);
      const color = schemaEntry
        ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index)
        : 'var(--accent-fg)';
      const menuItems = [
        ...entityMenuItems(entity, onClone, onDelete),
        ...projectEntityMenuItems(entity, projectContext)
      ];

      return (
        <div key={entity._uid} className={styles.card} onClick={() => onEntityClick(entity._publicId)}>
          <span className={styles.cardBar} style={{ background: color }} />
          <div className={styles.cardHead}>
            {schemaEntry && <TypeBadge color={color} name={schemaEntry.schema.name} size={22} />}
            <div className={styles.cardHeadRight}>
              {entity._lifecycle && (
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
          {entity._description && <div className={styles.cardDesc}>{entity._description}</div>}
          <div className={styles.cardMeta}>
            <Chip tone="ghost" icon={<TbUsers size={10} />}>
              {entity._owner?.name ?? '—'}
            </Chip>
            {schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>}
            {projectContext && entity._projectLink?.entityType?.name && (
              <Chip
                tone="ghost"
                dot={
                  projectContext.entityTypeColorMap.get(entity._projectLink.entityType.id) ?? undefined
                }
              >
                {entity._projectLink.entityType.name}
              </Chip>
            )}
            {projectContext && entity._projectLink?.linked && (
              <Chip tone="ghost">{entity._projectLink.isDone ? 'Done' : 'Open'}</Chip>
            )}
          </div>
        </div>
      );
    })}
  </div>
);
