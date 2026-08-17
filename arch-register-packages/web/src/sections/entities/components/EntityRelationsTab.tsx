import { useMemo, useState } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
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
import { useRelation, useDeleteRelation } from '../../../hooks/useRelations';
import { RelationRecordCard } from './RelationRecordList';
import { RelationAuditLogDialog } from '../../../dialogs/RelationAuditLogDialog';
import { RelationCreateDialog } from '../../../dialogs/RelationCreateDialog';
import { RelationEditDialog } from '../../../dialogs/RelationEditDialog';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

type Props = {
  workspaceId: string;
  outgoing: Relation[];
  incoming: Relation[];
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  entityId: string;
  entitySchemaId: string;
  entityName: string;
};

export const EntityRelationsTab = ({
  workspaceId,
  outgoing,
  incoming,
  schemas,
  relationSchemas,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  entityId,
  entitySchemaId,
  entityName
}: Props) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [editRelationId, setEditRelationId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    relationId: string;
    inEntityId: string;
    outEntityId: string;
    label: string;
  } | null>(null);
  const deleteMutation = useDeleteRelation(workspaceId);
  const typedRecords = useMemo(
    () => new Map([...typedRelationsOutgoing, ...typedRelationsIncoming].map(record => [record._uid, record])),
    [typedRelationsIncoming, typedRelationsOutgoing]
  );
  const relationCount = outgoing.length + incoming.length;
  const canCreateTypedRelation = relationSchemas.some(
    relation =>
      relation.in.schemaIds === 'any' ||
      relation.in.schemaIds.includes(entitySchemaId) ||
      relation.out.schemaIds === 'any' ||
      relation.out.schemaIds.includes(entitySchemaId)
  );

  if (relationCount === 0) {
    return (
      <div className={styles.relationsPage}>
        <EmptyState
          title="No relationships"
          subtitle="Add reference or containment fields to connect entities."
        />
        {canCreateTypedRelation && (
          <Button onClick={() => setCreateOpen(true)} style={{ marginTop: 12 }}>
            Add typed relation
          </Button>
        )}
        <RelationCreateDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          workspaceId={workspaceId}
          currentEntityId={entityId}
          currentSchemaId={entitySchemaId}
          currentEntityName={entityName}
          relationSchemas={relationSchemas}
          schemas={schemas}
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
              relationSchemas={relationSchemas}
              initialRecord={typedRecords.get(r.relationId ?? '')}
              onEdit={setEditRelationId}
              onDelete={setDeleteTarget}
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
              relationSchemas={relationSchemas}
              initialRecord={typedRecords.get(r.relationId ?? '')}
              onEdit={setEditRelationId}
              onDelete={setDeleteTarget}
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
      {canCreateTypedRelation && (
        <Button onClick={() => setCreateOpen(true)} style={{ marginTop: 12 }}>
          Add typed relation
        </Button>
      )}
      <RelationCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceId={workspaceId}
        currentEntityId={entityId}
        currentSchemaId={entitySchemaId}
        currentEntityName={entityName}
        relationSchemas={relationSchemas}
        schemas={schemas}
      />
      <RelationEditDialog
        open={editRelationId !== null}
        onClose={() => setEditRelationId(null)}
        workspaceId={workspaceId}
        relationId={editRelationId}
      />
      <DeleteConfirmationDialog
        open={deleteTarget !== null}
        title="Delete relation?"
        message={
          <>
            The relation <b>{deleteTarget?.label}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete relation"
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({
              relationId: deleteTarget.relationId,
              inEntityId: deleteTarget.inEntityId,
              outEntityId: deleteTarget.outEntityId
            });
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const TypedRelationRow = ({
  relation,
  direction,
  workspaceId,
  schemas,
  relationSchemas,
  initialRecord,
  onEdit,
  onDelete
}: {
  relation: Relation;
  direction: 'outgoing' | 'incoming';
  workspaceId: string;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  initialRecord?: RelationRecord;
  onEdit: (relationId: string) => void;
  onDelete: (target: {
    relationId: string;
    inEntityId: string;
    outEntityId: string;
    label: string;
  }) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { data: fetchedRecord } = useRelation(
    workspaceId,
    expanded && !initialRecord ? (relation.relationId ?? '') : ''
  );
  const record = initialRecord ?? fetchedRecord;
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
        workspaceId={workspaceId}
        expanded={expanded}
        onToggleExpand={() => setExpanded(v => !v)}
        onViewHistory={() => setShowHistory(true)}
        onEdit={record?.canEdit ? () => onEdit(record._uid) : undefined}
        onDelete={
          record?.canDelete
            ? () =>
                onDelete({
                  relationId: record._uid,
                  inEntityId: record._in.id,
                  outEntityId: record._out.id,
                  label: relationSchema?.name ?? getRelationDisplayLabel(relation)
                })
            : undefined
        }
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
