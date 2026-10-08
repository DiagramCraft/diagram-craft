import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { Chip } from '../../components/Chip';
import { Drawer } from '../../components/Drawer';
import { useEntitiesByIds } from '../../hooks/useEntities';
import { relationIds } from '../../lib/entityEditState';
import { formatRelationFieldValue } from '../dashboard/widgets/relationTableLogic';
import { useEntityDrawer } from '../entities/entityDrawer/useEntityDrawer';
import styles from './RelationDrawer.module.css';

/**
 * A generic detail panel for one relation instance: its endpoints (each opening the shared entity
 * drawer), then every populated field of its relation schema — entity-relation fields as
 * clickable chips, everything else as formatted text — and its owner/lifecycle. Not tied to any
 * relation type.
 */
export const RelationDrawer = ({
  workspaceSlug,
  relation,
  relationSchema,
  onClose
}: {
  workspaceSlug: string;
  relation: RelationRecord;
  relationSchema: RelationSchema | undefined;
  onClose: () => void;
}) => {
  const { openEntityDrawer } = useEntityDrawer();
  const fields = relationSchema?.fields ?? [];
  const carriedIds = fields.flatMap(field =>
    field.type === 'entityRelation' ? relationIds(relation[field.id]) : []
  );
  const entities = useEntitiesByIds(workspaceSlug, [
    relation._in.id,
    relation._out.id,
    ...carriedIds
  ]);

  const openEntity = (id: string) => {
    const ref = entities.get(id);
    if (ref) openEntityDrawer(ref.publicId);
  };

  const endpoint = (label: string, target: { id: string; name: string }) => (
    <div className={styles.attributeRow}>
      <span className={styles.attributeLabel}>{label}</span>
      <button type="button" className={styles.linkButton} onClick={() => openEntity(target.id)}>
        {target.name}
      </button>
    </div>
  );

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{relationSchema?.name ?? 'Relation'}</span>}
      title={`${relation._in.name} → ${relation._out.name}`}
      badges={
        relation._lifecycle ? <Chip tone="ghost">{relation._lifecycle.name}</Chip> : undefined
      }
    >
      <div className={styles.sectionLabel}>Endpoints</div>
      {endpoint('Source', relation._in)}
      {endpoint('Destination', relation._out)}

      <div className={styles.sectionLabel}>Details</div>
      {fields.map(field => {
        if (field.type === 'entityRelation') {
          const ids = relationIds(relation[field.id]);
          if (ids.length === 0) return null;
          return (
            <div key={field.id} className={styles.attributeRow}>
              <span className={styles.attributeLabel}>{field.name}</span>
              <span className={styles.chips}>
                {ids.map(id => (
                  <button
                    key={id}
                    type="button"
                    className={styles.linkButton}
                    onClick={() => openEntity(id)}
                  >
                    <Chip tone="ghost">{entities.get(id)?.name ?? id}</Chip>
                  </button>
                ))}
              </span>
            </div>
          );
        }
        const text = formatRelationFieldValue(field, relation[field.id]);
        if (text === '') return null;
        return (
          <div key={field.id} className={styles.attributeRow}>
            <span className={styles.attributeLabel}>{field.name}</span>
            <span>{text}</span>
          </div>
        );
      })}
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Owner</span>
        <span>{relation._owner?.name ?? '—'}</span>
      </div>
    </Drawer>
  );
};
