import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { Chip } from '../../../components/Chip';
import { resolveFieldAccess } from '../../../lib/fieldGroupAccess';
import { formatRelationFieldValue } from '../components/RelationRecordList';
import type { EntityDrawerFieldGroupAccess } from './entityDrawerState';
import { EntityDrawerProviderStatus } from './EntityDrawerProviderRegistry';
import styles from './EntityDrawer.module.css';

/**
 * Renders a generic `typed-relation-list` drawer item: the configured typed-relation field's
 * related entities, either as plain name chips (no `attributes` configured) or as rows with a
 * curated set of relation attribute columns. Replaces the hand-written typed-relation
 * lookup/filter logic that used to be duplicated per provider — the field→relationSchemaId→
 * direction lookup here mirrors `formatTypedRelationDisplayValue` in `entityFieldDisplay.tsx`.
 */
export const TypedRelationListItem = ({
  item,
  field,
  label,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  typedRelationsStatus,
  relationSchemas,
  getFieldGroupAccess
}: {
  item: Extract<EntityDrawerItem, { kind: 'typed-relation-list' }>;
  field: TypedRelationField;
  label: string;
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  typedRelationsStatus: { isLoading: boolean; isError: boolean };
  relationSchemas: RelationSchema[];
  getFieldGroupAccess: EntityDrawerFieldGroupAccess;
}) => {
  const direction = field.direction === 'in' ? 'outgoing' : 'incoming';
  const records = (
    field.direction === 'in' ? typedRelationsOutgoing : typedRelationsIncoming
  ).filter(record => record._schema.id === field.relationSchemaId);
  const otherEndpoint = (record: RelationRecord) =>
    direction === 'outgoing' ? record._out : record._in;

  const relationSchema = relationSchemas.find(candidate => candidate.id === field.relationSchemaId);
  const attributes = (item.attributes ?? []).flatMap(attribute => {
    const attributeField = relationSchema?.fields.find(
      candidate => candidate.id === attribute.fieldId && !candidate.archived
    );
    if (!attributeField || !relationSchema) return [];
    if (resolveFieldAccess(relationSchema, attributeField, getFieldGroupAccess) === 'none') {
      return [];
    }
    return [
      {
        fieldId: attribute.fieldId,
        label: attribute.label ?? attributeField.name,
        field: attributeField
      }
    ];
  });

  const state = typedRelationsStatus.isLoading
    ? 'loading'
    : typedRelationsStatus.isError
      ? 'unavailable'
      : records.length > 0
        ? 'ready'
        : 'empty';

  return (
    <EntityDrawerProviderStatus state={state} emptyMessage={`No ${label.toLowerCase()} linked.`}>
      {attributes.length > 0 ? (
        records.map(record => (
          <div className={styles.attributeRow} key={record._uid}>
            <span className={styles.attributeLabel}>{otherEndpoint(record).name}</span>
            <span className={styles.attributeValue}>
              {attributes
                .map(
                  attribute =>
                    formatRelationFieldValue(attribute.field, record[attribute.fieldId]) ?? '—'
                )
                .join(' · ')}
            </span>
          </div>
        ))
      ) : (
        <div className={styles.tags}>
          {records.map(record => (
            <Chip key={record._uid} tone="ghost">
              {otherEndpoint(record).name}
            </Chip>
          ))}
        </div>
      )}
    </EntityDrawerProviderStatus>
  );
};
