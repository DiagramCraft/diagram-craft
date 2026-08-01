import { TbChevronRight } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
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
  entityId: string;
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
  entityId,
  outgoing,
  incoming,
  relationSchemas
}: Props) => {
  const relationCount = outgoing.length + incoming.length;

  if (relationCount === 0) {
    return (
      <div className={styles.relationsPage}>
        <EmptyState
          title="No typed relations"
          subtitle="This entity doesn't participate in any typed relation instances yet."
        />
      </div>
    );
  }

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

  return (
    <div className={styles.relationsPage}>
      <div className={sharedStyles.sectionLabel}>Outgoing ({outgoing.length})</div>
      <RelationSchemaGroups
        entityId={entityId}
        groups={outgoingBySchema}
        direction="outgoing"
        relationSchemas={relationSchemas}
      />
      <div className={sharedStyles.sectionLabel} style={{ marginTop: 16 }}>
        Incoming ({incoming.length})
      </div>
      <RelationSchemaGroups
        entityId={entityId}
        groups={incomingBySchema}
        direction="incoming"
        relationSchemas={relationSchemas}
      />
    </div>
  );
};

const RelationSchemaGroups = ({
  groups,
  direction,
  relationSchemas
}: {
  entityId: string;
  groups: Map<string, RelationRecord[]>;
  direction: 'outgoing' | 'incoming';
  relationSchemas: RelationSchema[];
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
  relationSchema
}: {
  record: RelationRecord;
  direction: 'outgoing' | 'incoming';
  relationSchema: RelationSchema | undefined;
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
    <EntityNavigationLink publicId={otherEndpoint.id} className={styles.relation}>
      <span className={styles.relationLead}>
        <span className={styles.relationName}>{otherEndpoint.name}</span>
        {fieldSummaries.length > 0 && (
          <>
            <TbChevronRight size={10} className={sharedStyles.dim} />
            <span className={sharedStyles.dim}>{fieldSummaries.join(' · ')}</span>
          </>
        )}
      </span>
    </EntityNavigationLink>
  );
};
