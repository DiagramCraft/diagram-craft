import { TbChevronRight } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { Chip } from '../../../components/Chip';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Relation } from '../EntityDetailScreen';
import styles from './EntityRelationsTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';

type Props = {
  outgoing: Relation[];
  incoming: Relation[];
  schemas: EntitySchema[];
  onEntityClick: (entityId: string) => void;
};

export const EntityRelationsTab = ({ outgoing, incoming, schemas, onEntityClick }: Props) => {
  const relationCount = outgoing.length + incoming.length;

  if (relationCount === 0) {
    return (
      <div className={styles.relationsPage}>
        <div className={sharedStyles.empty}>
          <div className={sharedStyles.emptyTitle}>No relationships</div>
          <div>Add reference or containment fields to connect entities.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.relationsPage}>
      <div className={sharedStyles.sectionLabel}>Outgoing ({outgoing.length})</div>
      <div className={styles.relationsList}>
        {outgoing.map((r, i) => (
          <RelationRow
            key={`o-${i}`}
            relation={r}
            direction="outgoing"
            schemas={schemas}
            onEntityClick={onEntityClick}
          />
        ))}
        {outgoing.length === 0 && (
          <div className={sharedStyles.dim} style={{ padding: 8 }}>
            None
          </div>
        )}
      </div>
      <div className={sharedStyles.sectionLabel}>Incoming ({incoming.length})</div>
      <div className={styles.relationsList}>
        {incoming.map((r, i) => (
          <RelationRow
            key={`i-${i}`}
            relation={r}
            direction="incoming"
            schemas={schemas}
            onEntityClick={onEntityClick}
          />
        ))}
        {incoming.length === 0 && (
          <div className={sharedStyles.dim} style={{ padding: 8 }}>
            None
          </div>
        )}
      </div>
    </div>
  );
};

const RelationRow = ({
  relation,
  direction,
  schemas,
  onEntityClick
}: {
  relation: Relation;
  direction: 'outgoing' | 'incoming';
  schemas: EntitySchema[];
  onEntityClick: (entityId: string) => void;
}) => {
  const targetSchemaId = relation.entitySchemaId;
  const schemaIdx = schemas.findIndex(s => s.id === targetSchemaId);
  const targetSchema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const targetColor = targetSchema
    ? resolveSchemaColor(targetSchema, schemaIdx)
    : 'var(--accent-fg)';

  return (
    <button
      type="button"
      className={styles.relation}
      onClick={() => onEntityClick(relation.publicId)}
    >
      <span className={styles.relationLead}>
        {direction === 'incoming' ? (
          <>
            <TypeBadge
              color={targetColor}
              name={targetSchema?.name}
              icon={targetSchema?.icon}
              size={16}
            />
            <span className={styles.relationName}>{relation.entityName}</span>
            <TbChevronRight size={10} className={sharedStyles.dim} />
            <Chip tone="ghost">{getRelationDisplayLabel(relation)}</Chip>
          </>
        ) : (
          <>
            <Chip tone="ghost">{getRelationDisplayLabel(relation)}</Chip>
            <TbChevronRight size={10} className={sharedStyles.dim} />
            <TypeBadge
              color={targetColor}
              name={targetSchema?.name}
              icon={targetSchema?.icon}
              size={16}
            />
            <span className={styles.relationName}>{relation.entityName}</span>
          </>
        )}
      </span>
      <span className={sharedStyles.dim}>{relation.entitySlug}</span>
    </button>
  );
};
