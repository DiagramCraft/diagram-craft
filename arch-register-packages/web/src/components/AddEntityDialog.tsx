import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog } from './Dialog';
import { apiFetch, ApiError } from '../api';
import type { EntitySchema, EntitySummary, SchemaField, WorkspaceLifecycleState, WorkspaceOwnerOption } from '../api';
import { usePermissions } from '../auth/PermissionContext';
import { useEntitiesBySchema } from '../hooks/useEntities';
import { TbInfoCircle } from 'react-icons/tb';
import styles from './AddEntityDialog.module.css';

type EntityApiResponse = {
  _uid: string;
  [key: string]: unknown;
};

type AddEntityDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (entity: EntityApiResponse) => void;
  workspaceId: string;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  ownerOptions: WorkspaceOwnerOption[];
  preselectedSchemaId?: string | null;
};

export const AddEntityDialog = ({
  open,
  onClose,
  onCreated,
  workspaceId,
  schemas,
  lifecycleStates,
  ownerOptions,
  preselectedSchemaId,
}: AddEntityDialogProps) => {
  const { canCreateTopLevelEntity } = usePermissions();
  const [schemaId, setSchemaId] = useState('');
  const [entityName, setEntityName] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState({ description: '', owner: '', lifecycle: '', namespace: 'default', tags: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const creatableOwnerOptions = useMemo(
    () => ownerOptions.filter(option => canCreateTopLevelEntity(workspaceId, option.id)),
    [canCreateTopLevelEntity, ownerOptions, workspaceId]
  );
  const canCreateWithoutOwner = canCreateTopLevelEntity(workspaceId, null);

  useEffect(() => {
    if (open) {
      const initial = preselectedSchemaId ?? schemas[0]?.id ?? '';
      setSchemaId(initial);
      setEntityName('');
      setFields({});
      setMeta({
        description: '',
        owner: canCreateWithoutOwner ? '' : (creatableOwnerOptions[0]?.id ?? ''),
        lifecycle: '',
        namespace: 'default',
        tags: ''
      });
      setError('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [canCreateWithoutOwner, creatableOwnerOptions, open, preselectedSchemaId, schemas]);

  const selectedSchema = schemas.find(s => s.id === schemaId);

  const targetSchemaIds = useMemo(() => {
    if (!selectedSchema) return [];
    return [
      ...new Set(
        selectedSchema.fields
          .filter((field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
            field.type === 'reference' || field.type === 'containment'
          )
          .map(field => field.schemaId)
          .filter(Boolean)
      ),
    ];
  }, [selectedSchema]);

  const entitiesQueries = useEntitiesBySchema(workspaceId, targetSchemaIds);

  const derivedReferenceOptions = useMemo(() => {
    if (!open || targetSchemaIds.length === 0) return {};
    const nextOptions: Record<string, EntitySummary[]> = {};
    entitiesQueries.forEach((query, index) => {
      if (query.data) {
        nextOptions[targetSchemaIds[index]!] = query.data;
      }
    });
    return nextOptions;
  }, [open, targetSchemaIds, entitiesQueries]);

  const setField = (id: string, value: string) => setFields(f => ({ ...f, [id]: value }));
  const setMetaField = (key: string, value: string) => setMeta(m => ({ ...m, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schemaId) {
      setError('Please select a schema type');
      return;
    }
    if (!entityName.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    const dataFields: Record<string, unknown> = {};
    if (selectedSchema) {
      for (const f of selectedSchema.fields) {
        const val = fields[f.id];
        if (val !== undefined && val !== '') {
          if (f.type === 'boolean') {
            dataFields[f.id] = val === 'true';
          } else {
            dataFields[f.id] = val;
          }
        }
      }
    }

    const tags = meta.tags.split(',').map(s => s.trim()).filter(Boolean);

    const body = {
      _schemaId: schemaId,
      _name: entityName.trim(),
      _description: meta.description.trim(),
      _owner: meta.owner.trim() || null,
      _lifecycle: meta.lifecycle || null,
      _namespace: meta.namespace.trim() || 'default',
      _tags: tags,
      _links: [],
      ...dataFields,
    };

    try {
      const entity = await apiFetch<EntityApiResponse>(`/api/${workspaceId}/data`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(entity);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="New entity" panelClassName={styles.dialogPanel}>
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Schema picker */}
        <div className={styles.field}>
          <label>Type <span className={styles.required}>*</span></label>
          <select value={schemaId} onChange={e => setSchemaId(e.target.value)}>
            <option value="">Select a type</option>
            {schemas.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Name field */}
        <div className={styles.field}>
          <label>Name <span className={styles.required}>*</span></label>
          <input
            ref={nameRef}
            value={entityName}
            onChange={e => setEntityName(e.target.value)}
            placeholder="Entity name"
          />
        </div>

        <div className={styles.contentGrid}>
          {/* Schema-specific fields */}
          <div className={styles.propertiesSection}>
            {selectedSchema && (
              <>
                <div className={styles.sectionLabel}>Properties</div>
                <div className={styles.propertiesList}>
                  {selectedSchema.fields.filter(f => f.id !== 'name').map(f => (
                    <FieldInput
                      key={f.id}
                      field={f}
                      value={fields[f.id] ?? ''}
                      onChange={v => setField(f.id, v)}
                      referenceOptions={derivedReferenceOptions}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Metadata */}
          <div className={styles.metaSection}>
            <div className={styles.metaSectionLabel}>
              <TbInfoCircle size={11} /> Metadata
            </div>
            <div className={styles.field}>
              <label>Description</label>
              <textarea
                value={meta.description}
                onChange={e => setMetaField('description', e.target.value)}
                placeholder="Brief description of this entity"
              />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Owner</label>
                <select value={meta.owner} onChange={e => setMetaField('owner', e.target.value)}>
                  {canCreateWithoutOwner && <option value="">—</option>}
                  {creatableOwnerOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.id}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>Lifecycle</label>
                <select value={meta.lifecycle} onChange={e => setMetaField('lifecycle', e.target.value)}>
                  <option value="">—</option>
                  {lifecycleStates.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Namespace</label>
                <input
                  value={meta.namespace}
                  onChange={e => setMetaField('namespace', e.target.value)}
                  placeholder="default"
                />
              </div>
              <div className={styles.field}>
                <label>Tags</label>
                <input
                  value={meta.tags}
                  onChange={e => setMetaField('tags', e.target.value)}
                  placeholder="comma-separated"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.btnSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create entity'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

const FieldInput = ({
  field,
  value,
  onChange,
  nameRef,
  referenceOptions,
}: {
  field: SchemaField;
  value: string;
  onChange: (v: string) => void;
  nameRef?: React.RefObject<HTMLInputElement | null>;
  referenceOptions?: Record<string, EntitySummary[]>;
}) => {
  if (field.type === 'reference' || field.type === 'containment') {
    const candidates = referenceOptions?.[field.schemaId] ?? [];
    return (
      <div className={styles.field}>
        <label>{field.name}</label>
        <select value={value} onChange={e => onChange(e.target.value)}>
          <option value="">—</option>
          {candidates.map(entity => (
            <option key={entity._uid} value={entity._uid}>
              {entity._name || entity._slug}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className={styles.field}>
        <label>{field.name}</label>
        <select value={value} onChange={e => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'longtext') {
    return (
      <div className={styles.field}>
        <label>{field.name}</label>
        <textarea value={value} onChange={e => onChange(e.target.value)} />
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className={styles.field}>
        <label>
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={e => onChange(e.target.checked ? 'true' : 'false')}
          />
          {field.name}
        </label>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label>{field.name}</label>
      <input
        ref={field.id === 'name' ? nameRef : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
};
