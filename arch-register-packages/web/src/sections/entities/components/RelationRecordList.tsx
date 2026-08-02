import { TbChevronRight } from 'react-icons/tb';
import type {
  RelationField,
  RelationSchema
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import styles from './EntityRelationsTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';

export const KEY_FIELD_COUNT = 3;

export const formatRelationFieldValue = (field: RelationField, value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

export type RelationDirection = 'outgoing' | 'incoming';

export const RelationRecordRow = ({
  record,
  direction,
  relationSchema,
  onInspect
}: {
  record: RelationRecord;
  direction: RelationDirection;
  relationSchema: RelationSchema | undefined;
  onInspect: (record: RelationRecord) => void;
}) => {
  const otherEndpoint = direction === 'outgoing' ? record._out : record._in;
  const keyFields = (relationSchema?.fields ?? [])
    .filter(f => !f.archived)
    .slice(0, KEY_FIELD_COUNT);
  const fieldSummaries = keyFields
    .map(field => {
      const formatted = formatRelationFieldValue(field, record[field.id]);
      return formatted !== null ? `${field.name}: ${formatted}` : null;
    })
    .filter((v): v is string => v !== null);

  return (
    // biome-ignore lint/a11y/useSemanticElements: a <button> can't legally contain the nested <a> (entity link)
    <div
      className={styles.relation}
      role="button"
      tabIndex={0}
      title="Inspect relation"
      onClick={() => onInspect(record)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onInspect(record);
        }
      }}
    >
      <span className={styles.relationLead}>
        <EntityNavigationLink
          publicId={otherEndpoint.id}
          className={styles.relationName}
          onClick={event => event.stopPropagation()}
        >
          {otherEndpoint.name}
        </EntityNavigationLink>
        {fieldSummaries.length > 0 && (
          <>
            <TbChevronRight size={10} className={sharedStyles.dim} />
            <span className={sharedStyles.dim}>{fieldSummaries.join(' · ')}</span>
          </>
        )}
      </span>
    </div>
  );
};

export const RelationRecordList = ({
  records,
  direction,
  relationSchema,
  onInspect
}: {
  records: RelationRecord[];
  direction: RelationDirection;
  relationSchema: RelationSchema | undefined;
  onInspect: (record: RelationRecord) => void;
}) => {
  if (records.length === 0) return null;
  return (
    <div className={styles.relationsList}>
      {records.map(record => (
        <RelationRecordRow
          key={record._uid}
          record={record}
          direction={direction}
          relationSchema={relationSchema}
          onInspect={onInspect}
        />
      ))}
    </div>
  );
};
