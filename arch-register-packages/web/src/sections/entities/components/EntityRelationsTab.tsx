import { useState } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { Chip } from '../../../components/Chip';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Relation } from '../types/entityDetailTypes';
import styles from './EntityRelationsTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';
import { EmptyState } from '../../../components/EmptyState';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { useRelation } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { RelationRecordCard } from './RelationRecordList';
import { RelationAuditLogDialog } from '../../../dialogs/RelationAuditLogDialog';

type Props = {
  workspaceId: string;
  outgoing: Relation[];
  incoming: Relation[];
  schemas: EntitySchema[];
};

export const EntityRelationsTab = ({ workspaceId, outgoing, incoming, schemas }: Props) => {
  const relationCount = outgoing.length + incoming.length;

  if (relationCount === 0) {
    return (
      <div className={styles.relationsPage}>
        <EmptyState
          title="No relationships"
          subtitle="Add reference or containment fields to connect entities."
        />
      </div>
    );
  }

  return (
    <div className={styles.relationsPage}>
      <div className={sharedStyles.sectionLabel}>Outgoing ({outgoing.length})</div>
      <div className={styles.relationsList}>
        {outgoing.map((r, i) =>
          r.kind === 'typed' ? (
            <TypedRelationRow
              key={`o-${i}`}
              relation={r}
              direction="outgoing"
              workspaceId={workspaceId}
              schemas={schemas}
            />
          ) : (
            <RelationRow key={`o-${i}`} relation={r} direction="outgoing" schemas={schemas} />
          )
        )}
        {outgoing.length === 0 && (
          <div className={sharedStyles.dim} style={{ padding: 8 }}>
            None
          </div>
        )}
      </div>
      <div className={sharedStyles.sectionLabel}>Incoming ({incoming.length})</div>
      <div className={styles.relationsList}>
        {incoming.map((r, i) =>
          r.kind === 'typed' ? (
            <TypedRelationRow
              key={`i-${i}`}
              relation={r}
              direction="incoming"
              workspaceId={workspaceId}
              schemas={schemas}
            />
          ) : (
            <RelationRow key={`i-${i}`} relation={r} direction="incoming" schemas={schemas} />
          )
        )}
        {incoming.length === 0 && (
          <div className={sharedStyles.dim} style={{ padding: 8 }}>
            None
          </div>
        )}
      </div>
    </div>
  );
};

const TypedRelationRow = ({
  relation,
  direction,
  workspaceId,
  schemas
}: {
  relation: Relation;
  direction: 'outgoing' | 'incoming';
  workspaceId: string;
  schemas: EntitySchema[];
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { data: record } = useRelation(workspaceId, expanded ? (relation.relationId ?? '') : '');
  const { data: relationSchemas } = useRelationSchemas(workspaceId, expanded);
  const relationSchema = relationSchemas?.find(s => s.id === record?._schema.id);

  const targetSchemaId = relation.entitySchemaId;
  const schemaIdx = schemas.findIndex(s => s.id === targetSchemaId);
  const targetSchema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const targetColor = targetSchema
    ? resolveSchemaColor(targetSchema, schemaIdx)
    : 'var(--accent-fg)';

  if (!expanded || !record) {
    return (
      <button type="button" className={styles.relation} onClick={() => setExpanded(true)}>
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
  }

  return (
    <>
      <RelationRecordCard
        record={record}
        direction={direction}
        relationSchema={relationSchema}
        expanded={expanded}
        onToggleExpand={() => setExpanded(v => !v)}
        onViewHistory={() => setShowHistory(true)}
      />
      <RelationAuditLogDialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        workspaceId={workspaceId}
        relation={record}
      />
    </>
  );
};

const RelationRow = ({
  relation,
  direction,
  schemas
}: {
  relation: Relation;
  direction: 'outgoing' | 'incoming';
  schemas: EntitySchema[];
}) => {
  const targetSchemaId = relation.entitySchemaId;
  const schemaIdx = schemas.findIndex(s => s.id === targetSchemaId);
  const targetSchema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const targetColor = targetSchema
    ? resolveSchemaColor(targetSchema, schemaIdx)
    : 'var(--accent-fg)';

  return (
    <EntityNavigationLink publicId={relation.publicId} className={styles.relation}>
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
    </EntityNavigationLink>
  );
};
