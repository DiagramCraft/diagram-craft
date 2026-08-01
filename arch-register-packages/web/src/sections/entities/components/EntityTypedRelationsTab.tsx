import { useState } from 'react';
import { TbChevronRight, TbInfoCircle, TbPlus } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { AddRelationDialog } from '../../../dialogs/AddRelationDialog';
import { RelationDetailDialog } from '../../../dialogs/RelationDetailDialog';
import type {
  RelationField,
  RelationSchema
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import styles from './EntityRelationsTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';
import { EmptyState } from '../../../components/EmptyState';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';

type Props = {
  workspaceId: string;
  entityId: string;
  entityName: string;
  entitySchemaId: string;
  canEdit: boolean;
  outgoing: RelationRecord[];
  incoming: RelationRecord[];
  relationSchemas: RelationSchema[];
};

const formatFieldValue = (field: RelationField, value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const KEY_FIELD_COUNT = 3;

export const EntityTypedRelationsTab = ({
  workspaceId,
  entityId,
  entityName,
  entitySchemaId,
  canEdit,
  outgoing,
  incoming,
  relationSchemas
}: Props) => {
  const [addDialogEndpoint, setAddDialogEndpoint] = useState<'in' | 'out' | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<RelationRecord | null>(null);

  const groupBySchema = (records: RelationRecord[]) => {
    const groups = new Map<string, RelationRecord[]>();
    for (const record of records) {
      const list = groups.get(record._schema.id) ?? [];
      list.push(record);
      groups.set(record._schema.id, list);
    }
    return groups;
  };

  const outgoingBySchema = groupBySchema(outgoing);
  const incomingBySchema = groupBySchema(incoming);
  const relationCount = outgoing.length + incoming.length;

  const eligibleAsIn = relationSchemas.some(rs => rs.in.schemaIds.includes(entitySchemaId));
  const eligibleAsOut = relationSchemas.some(rs => rs.out.schemaIds.includes(entitySchemaId));

  return (
    <div className={styles.relationsPage}>
      {relationCount === 0 && !eligibleAsIn && !eligibleAsOut && (
        <EmptyState
          title="No typed relations"
          subtitle="This entity doesn't participate in any typed relation instances yet."
        />
      )}

      {(relationCount > 0 || eligibleAsIn) && (
        <>
          <div className={sharedStyles.sectionLabel} style={{ display: 'flex', gap: 8 }}>
            <span style={{ flex: 1 }}>Outgoing ({outgoing.length})</span>
            {canEdit && eligibleAsIn && (
              <Button
                variant="ghost"
                icon={<TbPlus size={11} />}
                onClick={() => setAddDialogEndpoint('in')}
              >
                Add relation
              </Button>
            )}
          </div>
          <RelationSchemaGroups
            groups={outgoingBySchema}
            direction="outgoing"
            relationSchemas={relationSchemas}
            onInspect={setSelectedRelation}
          />
        </>
      )}

      {(relationCount > 0 || eligibleAsOut) && (
        <>
          <div
            className={sharedStyles.sectionLabel}
            style={{ display: 'flex', gap: 8, marginTop: 16 }}
          >
            <span style={{ flex: 1 }}>Incoming ({incoming.length})</span>
            {canEdit && eligibleAsOut && (
              <Button
                variant="ghost"
                icon={<TbPlus size={11} />}
                onClick={() => setAddDialogEndpoint('out')}
              >
                Add relation
              </Button>
            )}
          </div>
          <RelationSchemaGroups
            groups={incomingBySchema}
            direction="incoming"
            relationSchemas={relationSchemas}
            onInspect={setSelectedRelation}
          />
        </>
      )}

      <AddRelationDialog
        open={addDialogEndpoint !== null}
        onClose={() => setAddDialogEndpoint(null)}
        onCreated={() => setAddDialogEndpoint(null)}
        workspaceId={workspaceId}
        relationSchemas={relationSchemas}
        fixedEntityId={entityId}
        fixedEntityName={entityName}
        fixedEntitySchemaId={entitySchemaId}
        fixedEndpoint={addDialogEndpoint ?? 'in'}
      />

      <RelationDetailDialog
        open={selectedRelation !== null}
        onClose={() => setSelectedRelation(null)}
        workspaceId={workspaceId}
        relation={selectedRelation}
        relationSchema={relationSchemas.find(rs => rs.id === selectedRelation?._schema.id)}
      />
    </div>
  );
};

const RelationSchemaGroups = ({
  groups,
  direction,
  relationSchemas,
  onInspect
}: {
  groups: Map<string, RelationRecord[]>;
  direction: 'outgoing' | 'incoming';
  relationSchemas: RelationSchema[];
  onInspect: (record: RelationRecord) => void;
}) => {
  if (groups.size === 0) {
    return (
      <div className={sharedStyles.dim} style={{ padding: 8 }}>
        None
      </div>
    );
  }

  return (
    <>
      {[...groups.entries()].map(([schemaId, records]) => {
        const schemaIdx = relationSchemas.findIndex(s => s.id === schemaId);
        const relationSchema = schemaIdx >= 0 ? relationSchemas[schemaIdx] : undefined;
        const color = relationSchema
          ? resolveSchemaColor(relationSchema, schemaIdx)
          : 'var(--accent-fg)';
        return (
          <div key={schemaId} style={{ marginBottom: 12 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
              className={sharedStyles.dim}
            >
              <TypeBadge
                color={color}
                name={relationSchema?.name}
                icon={relationSchema?.icon}
                size={14}
              />
              {relationSchema?.name ?? 'Unknown relation type'}
            </div>
            <div className={styles.relationsList}>
              {records.map(record => (
                <RelationRow
                  key={record._uid}
                  record={record}
                  direction={direction}
                  relationSchema={relationSchema}
                  onInspect={onInspect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};

const RelationRow = ({
  record,
  direction,
  relationSchema,
  onInspect
}: {
  record: RelationRecord;
  direction: 'outgoing' | 'incoming';
  relationSchema: RelationSchema | undefined;
  onInspect: (record: RelationRecord) => void;
}) => {
  const otherEndpoint = direction === 'outgoing' ? record._out : record._in;
  const keyFields = (relationSchema?.fields ?? [])
    .filter(f => !f.archived)
    .slice(0, KEY_FIELD_COUNT);
  const fieldSummaries = keyFields
    .map(field => {
      const formatted = formatFieldValue(field, record[field.id]);
      return formatted !== null ? `${field.name}: ${formatted}` : null;
    })
    .filter((v): v is string => v !== null);

  return (
    <div className={styles.relation}>
      <EntityNavigationLink publicId={otherEndpoint.id} className={styles.relationLead}>
        <span className={styles.relationName}>{otherEndpoint.name}</span>
        {fieldSummaries.length > 0 && (
          <>
            <TbChevronRight size={10} className={sharedStyles.dim} />
            <span className={sharedStyles.dim}>{fieldSummaries.join(' · ')}</span>
          </>
        )}
      </EntityNavigationLink>
      <button
        type="button"
        title="Inspect relation"
        aria-label="Inspect relation"
        className={sharedStyles.dim}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        onClick={() => onInspect(record)}
      >
        <TbInfoCircle size={14} />
      </button>
    </div>
  );
};
