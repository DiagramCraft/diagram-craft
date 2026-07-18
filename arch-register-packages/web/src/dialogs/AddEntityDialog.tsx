import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { FormGroup } from '@diagram-craft/app-components/FormGroup';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { orpcClient } from '../lib/orpcClient';
import { ApiError } from '../lib/http';
import { Banner } from '../components/Banner';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { usePermissions } from '../auth/PermissionContext';
import { useEntitiesBySchema } from '../hooks/useEntities';
import { TbInfoCircle, TbAdjustments } from 'react-icons/tb';
import styles from './AddEntityDialog.module.css';
import { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { EntityFieldInput } from './EntityFieldInput';
import { applyEntityTemplate, createEntityFormDefaults } from '../lib/entityTemplates';

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
  const [templateId, setTemplateId] = useState('');
  const [templateWarnings, setTemplateWarnings] = useState<string[]>([]);
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
      const baseline = createEntityFormDefaults(
        canCreateWithoutOwner ? '' : (creatableTeams[0]?.id ?? '')
      );
      setTemplateId('');
      setTemplateWarnings([]);
      setFields(baseline.fields);
      setMeta(baseline.meta);
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

  useEffect(() => {
    if (!templateId || !selectedSchema || entitiesQueries.some(query => query.isPending)) return;
    const relationshipFields = selectedSchema.fields.filter(
      (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
        field.type === 'reference' || field.type === 'containment'
    );
    const template = selectedSchema.templates.find(item => item.id === templateId);
    const removedLabels = relationshipFields.flatMap(field => {
      const value = template?.values.fields[field.id];
      if (!Array.isArray(value)) return [];
      const available = new Set(
        (derivedReferenceOptions[field.schemaId] ?? []).map(entity => entity._uid)
      );
      return value.some(id => !available.has(id))
        ? [`${field.name} contains unavailable entities`]
        : [];
    });
    setFields(current => {
      let changed = false;
      const next = { ...current };
      for (const field of relationshipFields) {
        const value = current[field.id];
        if (!Array.isArray(value)) continue;
        const available = new Set(
          (derivedReferenceOptions[field.schemaId] ?? []).map(entity => entity._uid)
        );
        const valid = value.filter(
          (id): id is string => typeof id === 'string' && available.has(id)
        );
        if (valid.length === value.length) continue;
        changed = true;
        if (valid.length > 0) next[field.id] = valid;
        else delete next[field.id];
      }
      return changed ? next : current;
    });
    if (removedLabels.length > 0) {
      setTemplateWarnings(current => {
        const next = [...new Set([...current, ...removedLabels])];
        return next.length === current.length ? current : next;
      });
    }
  }, [templateId, selectedSchema, entitiesQueries, derivedReferenceOptions]);

  const resetAndApplyTemplate = (nextTemplateId: string, schema = selectedSchema) => {
    const baseline = createEntityFormDefaults(
      canCreateWithoutOwner ? '' : (creatableTeams[0]?.id ?? '')
    );
    setTemplateId(nextTemplateId);
    setTemplateWarnings([]);
    if (!schema || !nextTemplateId) {
      setFields(baseline.fields);
      setMeta(baseline.meta);
      return;
    }
    const template = schema.templates.find(item => item.id === nextTemplateId);
    if (!template) return;
    const applied = applyEntityTemplate({
      baseline,
      schema,
      template,
      allowedOwnerIds: new Set(creatableTeams.map(team => team.id)),
      lifecycleIds: new Set(lifecycleStates.map(state => state.id)),
      referenceOptions: Object.fromEntries(
        Object.entries(derivedReferenceOptions).map(([targetSchemaId, entities]) => [
          targetSchemaId,
          new Set(entities.map(entity => entity._uid))
        ])
      )
    });
    setFields(applied.fields);
    setMeta(applied.meta);
    setTemplateWarnings(applied.warnings);
  };

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
          } else if (f.type === 'number') {
            dataFields[f.id] = Number(val);
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
        <div className={styles.schemaPickers}>
          {/* Schema picker */}
          <div data-testid="new-entity-type">
            <FormElement label="Type" required hint={selectedSchema?.description}>
              <Select.Root
                value={schemaId || undefined}
                onChange={value => {
                  const nextSchemaId = value ?? '';
                  setSchemaId(nextSchemaId);
                  resetAndApplyTemplate(
                    '',
                    schemas.find(schema => schema.id === nextSchemaId)
                  );
                }}
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
          </div>

          <div data-testid="new-entity-template">
            <FormElement label="Template" required={false}>
              <Select.Root
                value={templateId || '__none__'}
                onChange={value => resetAndApplyTemplate(value === '__none__' ? '' : (value ?? ''))}
                placeholder="No template"
                style={{ width: '100%' }}
              >
                <Select.Item value="__none__">No template</Select.Item>
                {(selectedSchema?.templates ?? []).map(template => (
                  <Select.Item key={template.id} value={template.id}>
                    {template.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          </div>
        </div>

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
                    <EntityFieldInput
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
            <FormElement label="Description" required={false}>
              <TextArea
                value={meta.description}
                onChange={value => setMetaField('description', value ?? '')}
                placeholder="Brief description of this entity"
                rows={3}
                style={{ width: '100%' }}
              />
            </FormElement>
            <div className={styles.row}>
              <FormElement label="Owner" required={false}>
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
              <FormElement label="Lifecycle" required={false}>
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
              <FormElement label="Namespace" required={false}>
                <TextInput
                  value={meta.namespace}
                  onChange={value => setMetaField('namespace', value ?? '')}
                  placeholder="default"
                  style={{ width: '100%' }}
                />
              </FormElement>
              <FormElement label="Tags" required={false}>
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

        {error && <Banner variant="error">{error}</Banner>}
        {templateWarnings.length > 0 && (
          <Banner variant="warning">
            Some template defaults were unavailable and were cleared: {templateWarnings.join('; ')}.
          </Banner>
        )}
      </form>
    </Dialog>
  );
};
