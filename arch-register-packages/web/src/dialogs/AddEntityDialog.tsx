import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { FormGroup } from '@diagram-craft/app-components/FormGroup';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { orpcClient } from '../lib/orpcClient';
import { ApiError } from '../lib/http';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { usePermissions } from '../auth/PermissionContext';
import { useEntitiesBySchema } from '../hooks/useEntities';
import { TbInfoCircle, TbAdjustments } from 'react-icons/tb';
import styles from './AddEntityDialog.module.css';
import { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import { EntitySummary } from '@arch-register/api-types/entityContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';

type EntityApiResponse = {
  _uid: string;
  _publicId: string;
  [key: string]: unknown;
};

const getRelationFieldValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

type AddEntityDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (entity: EntityApiResponse) => void;
  workspaceId: string;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  preselectedSchemaId?: string | null;
};

export const AddEntityDialog = ({
  open,
  onClose,
  onCreated,
  workspaceId,
  schemas,
  lifecycleStates,
  teams,
  preselectedSchemaId
}: AddEntityDialogProps) => {
  const { canCreateTopLevelEntity } = usePermissions();
  const [schemaId, setSchemaId] = useState('');
  const [entityName, setEntityName] = useState('');
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [meta, setMeta] = useState({
    description: '',
    owner: '',
    lifecycle: '',
    namespace: 'default',
    tags: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const creatableTeams = useMemo(
    () => teams.filter(team => canCreateTopLevelEntity(workspaceId, team.id)),
    [canCreateTopLevelEntity, teams, workspaceId]
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
        owner: canCreateWithoutOwner ? '' : (creatableTeams[0]?.id ?? ''),
        lifecycle: '',
        namespace: 'default',
        tags: ''
      });
      setError('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [canCreateWithoutOwner, creatableTeams, open, preselectedSchemaId, schemas]);

  const selectedSchema = schemas.find(s => s.id === schemaId);

  const targetSchemaIds = useMemo(() => {
    if (!selectedSchema) return [];
    return [
      ...new Set(
        selectedSchema.fields
          .filter(
            (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
              field.type === 'reference' || field.type === 'containment'
          )
          .map(field => field.schemaId)
          .filter(Boolean)
      )
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

  const setField = (id: string, value: unknown) => setFields(f => ({ ...f, [id]: value }));
  const setMetaField = (key: string, value: string) => setMeta(m => ({ ...m, [key]: value }));

  const handleSubmit = async () => {
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
        const isEmptyArray = Array.isArray(val) && val.length === 0;
        if (val !== undefined && val !== '' && !isEmptyArray) {
          if (f.type === 'boolean') {
            dataFields[f.id] = val === 'true';
          } else {
            dataFields[f.id] = val;
          }
        }
      }
    }

    const tags = meta.tags
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const body = {
      _schemaId: schemaId,
      _name: entityName.trim(),
      _description: meta.description.trim(),
      _owner: meta.owner.trim() || null,
      _lifecycle: meta.lifecycle || null,
      _namespace: meta.namespace.trim() || 'default',
      _tags: tags,
      _links: [],
      ...dataFields
    };

    try {
      const entity = await orpcClient.entities.create({
        params: { workspace: workspaceId },
        body
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
    <Dialog
      open={open}
      onClose={onClose}
      title="New entity"
      width="min(1040px, calc(100vw - 48px))"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: submitting ? 'Creating...' : 'Create entity',
          type: 'default',
          disabled: submitting,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <form
        className={styles.form}
        onSubmit={e => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <button type="submit" hidden />
        {/* Schema picker */}
        <FormElement label="Type" required hint={selectedSchema?.description}>
          <Select.Root
            value={schemaId || undefined}
            onChange={value => setSchemaId(value ?? '')}
            placeholder="Select a type"
            style={{ width: '100%' }}
          >
            {schemas.map(s => (
              <Select.Item key={s.id} value={s.id}>
                {s.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>

        {/* Name field */}
        <FormElement label="Name" required>
          <TextInput
            ref={nameRef}
            value={entityName}
            onChange={value => setEntityName(value ?? '')}
            placeholder="Entity name"
            style={{ width: '100%' }}
          />
        </FormElement>

        <div className={styles.contentGrid}>
          {/* Schema-specific fields */}
          <FormGroup label="Properties" icon={<TbAdjustments size={12} />}>
            {selectedSchema && (
              <div className={styles.propertiesList}>
                {selectedSchema.fields
                  .filter(f => f.id !== 'name')
                  .map(f => (
                    <FieldInput
                      key={f.id}
                      field={f}
                      value={
                        f.type === 'reference' || f.type === 'containment'
                          ? getRelationFieldValue(fields[f.id])
                          : ((fields[f.id] ?? '') as string)
                      }
                      onChange={v => setField(f.id, v)}
                      referenceOptions={derivedReferenceOptions}
                    />
                  ))}
              </div>
            )}
          </FormGroup>

          {/* Metadata */}
          <FormGroup label="Metadata" icon={<TbInfoCircle size={11} />}>
            <FormElement label="Description">
              <TextArea
                value={meta.description}
                onChange={value => setMetaField('description', value ?? '')}
                placeholder="Brief description of this entity"
                rows={3}
                style={{ width: '100%' }}
              />
            </FormElement>
            <div className={styles.row}>
              <FormElement label="Owner">
                <Select.Root
                  value={meta.owner || undefined}
                  onChange={value => setMetaField('owner', value ?? '')}
                  placeholder="—"
                  style={{ width: '100%' }}
                >
                  {creatableTeams.map(team => (
                    <Select.Item key={team.id} value={team.id}>
                      {team.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </FormElement>
              <FormElement label="Lifecycle">
                <Select.Root
                  value={meta.lifecycle || undefined}
                  onChange={value => setMetaField('lifecycle', value ?? '')}
                  placeholder="—"
                  style={{ width: '100%' }}
                >
                  {lifecycleStates.map(s => (
                    <Select.Item key={s.id} value={s.id}>
                      {s.label}
                    </Select.Item>
                  ))}
                </Select.Root>
              </FormElement>
            </div>
            <div className={styles.row}>
              <FormElement label="Namespace">
                <TextInput
                  value={meta.namespace}
                  onChange={value => setMetaField('namespace', value ?? '')}
                  placeholder="default"
                  style={{ width: '100%' }}
                />
              </FormElement>
              <FormElement label="Tags">
                <TextInput
                  value={meta.tags}
                  onChange={value => setMetaField('tags', value ?? '')}
                  placeholder="comma-separated"
                  style={{ width: '100%' }}
                />
              </FormElement>
            </div>
          </FormGroup>
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </form>
    </Dialog>
  );
};

const FieldInput = ({
  field,
  value,
  onChange,
  nameRef,
  referenceOptions
}: {
  field: EntitySchema['fields'][number];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  nameRef?: React.RefObject<HTMLInputElement | null>;
  referenceOptions?: Record<string, EntitySummary[]>;
}) => {
  if (field.type === 'reference') {
    const candidates = referenceOptions?.[field.schemaId] ?? [];
    return (
      <FormElement label={field.name}>
        <select
          multiple
          value={Array.isArray(value) ? value : []}
          onChange={event =>
            onChange(Array.from(event.currentTarget.selectedOptions, option => option.value))
          }
          style={{ width: '100%', minHeight: 120 }}
        >
          {candidates.map(entity => (
            <option key={entity._uid} value={entity._uid}>
              {entity._name || entity._slug}
            </option>
          ))}
        </select>
      </FormElement>
    );
  }

  if (field.type === 'containment') {
    const candidates = referenceOptions?.[field.schemaId] ?? [];
    const selected = Array.isArray(value) ? value[0] ?? '' : '';
    return (
      <FormElement label={field.name}>
        <Select.Root
          value={selected || undefined}
          onChange={nextValue => onChange(nextValue ? [nextValue] : [])}
          placeholder="—"
          style={{ width: '100%' }}
        >
          {candidates.map(entity => (
            <Select.Item key={entity._uid} value={entity._uid}>
              {entity._name || entity._slug}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
    );
  }

  if (field.type === 'select') {
    return (
      <FormElement label={field.name}>
        <Select.Root
          value={typeof value === 'string' ? value || undefined : undefined}
          onChange={nextValue => onChange(nextValue ?? '')}
          placeholder="—"
          style={{ width: '100%' }}
        >
          {field.options.map(o => (
            <Select.Item key={o.value} value={o.value}>
              {o.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
    );
  }

  if (field.type === 'longtext') {
    return (
      <FormElement label={field.name}>
        <TextArea
          value={typeof value === 'string' ? value : ''}
          onChange={nextValue => onChange(nextValue ?? '')}
          rows={3}
          style={{ width: '100%' }}
        />
      </FormElement>
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

  if (field.type === 'date') {
    return (
      <FormElement label={field.name}>
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%' }}
        />
      </FormElement>
    );
  }

  return (
    <FormElement label={field.name}>
      <TextInput
        ref={field.id === 'name' ? nameRef : undefined}
        value={typeof value === 'string' ? value : ''}
        onChange={nextValue => onChange(nextValue ?? '')}
        style={{ width: '100%' }}
      />
    </FormElement>
  );
};
