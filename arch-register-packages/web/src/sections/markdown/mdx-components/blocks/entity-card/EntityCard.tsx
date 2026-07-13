import { useNavigate } from '@tanstack/react-router';
import type { ApiSelectField, EntitySchema } from '@arch-register/api-types/schemaContract';
import { Banner } from '../../../../../components/Banner';
import { TypeBadge } from '../../../../../components/TypeBadge';
import { StatusChip } from '../../../../../components/StatusChip';
import { useEntity } from '../../../../../hooks/useEntities';
import { resolveSchemaColor } from '../../../../../lib/schemaPresentation';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { entityDetailRoute, asEntityPublicId } from '../../../../../routes/publicObjectRoutes';
import { LoadingState } from '../../../../../components/LoadingState';
import styles from './EntityCard.module.css';
import { formatDate } from '../../../../../utils/dateFormat';

export const filterSchemaFields = <T extends { type: string }>(fields: T[]): T[] =>
  fields.filter(f => f.type !== 'containment' && f.type !== 'reference');

export const STANDARD_FIELD_OPTIONS = [
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'owner', label: 'Owner' },
  { id: 'description', label: 'Description' },
  { id: 'tags', label: 'Tags' }
] as const;

export const DEFAULT_FIELDS = ['lifecycle', 'owner'];
export const STANDARD_FIELD_IDS: Set<string> = new Set(STANDARD_FIELD_OPTIONS.map(f => f.id));

export const renderSchemaFieldValue = (
  field: EntitySchema['fields'][number],
  value: unknown
): string | null => {
  if (value == null || value === '') return null;
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'select') {
    const selectField = field as ApiSelectField;
    if (!selectField.options) return String(value);
    const opt = selectField.options.find(o => o.value === String(value));
    return opt?.label ?? String(value);
  }
  if (field.type === 'date') return formatDate(value, String(value));
  if (field.type === 'reference' || field.type === 'containment') return null;
  return String(value);
};

export const EntityCard = ({ id, fields }: { id: string; fields?: string }) => {
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();
  const { data: entity, isLoading, isError } = useEntity(workspaceSlug, id);
  const navigate = useNavigate();

  if (!id) return null;

  if (isLoading) {
    return (
      <div className={styles.card}>
        <LoadingState text="Loading…" size="sm" />
      </div>
    );
  }

  if (isError || !entity) {
    return <Banner variant="error">Entity not found: {id}</Banner>;
  }

  const schemaIdx = schemas.findIndex(s => s.id === entity._schema?.id);
  const schema = schemaIdx >= 0 ? schemas[schemaIdx] : undefined;
  const color = schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)';

  const activeFields = fields ? fields.split(',').filter(Boolean) : DEFAULT_FIELDS;
  const showLifecycle = activeFields.includes('lifecycle');
  const showOwner = activeFields.includes('owner');
  const showDescription = activeFields.includes('description');
  const showTags = activeFields.includes('tags');
  const schemaFieldIds = activeFields.filter(f => !STANDARD_FIELD_IDS.has(f));

  type LabeledField = { key: string; label: string; value: string };
  const labeledFields: LabeledField[] = [];
  if (showOwner && entity._owner) {
    labeledFields.push({ key: 'owner', label: 'Owner', value: entity._owner.name });
  }
  for (const fieldId of schemaFieldIds) {
    const fieldDef = schema?.fields.find(f => f.id === fieldId);
    if (!fieldDef) continue;
    const rendered = renderSchemaFieldValue(fieldDef, (entity as Record<string, unknown>)[fieldId]);
    if (rendered != null)
      labeledFields.push({ key: fieldId, label: fieldDef.name, value: rendered });
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={18} />
        <span className={styles.name}>{entity._name}</span>
        {schema && <span className={styles.schema}>{schema.name}</span>}
      </div>

      {showLifecycle && entity._lifecycle && (
        <div className={styles.meta}>
          <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
        </div>
      )}

      {showDescription && entity._description && (
        <p className={styles.description}>{entity._description}</p>
      )}

      {showTags && entity._tags.length > 0 && (
        <div className={styles.tags}>
          {entity._tags.map(tag => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {labeledFields.length > 0 && (
        <dl className={styles.schemaFields}>
          {labeledFields.map(({ key, label, value }) => (
            <div key={key} className={styles.schemaField}>
              <dt className={styles.schemaFieldLabel}>{label}</dt>
              <dd className={styles.schemaFieldValue}>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <button
        type="button"
        className={styles.link}
        onClick={() => navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(id)))}
      >
        View in catalog →
      </button>
    </div>
  );
};
