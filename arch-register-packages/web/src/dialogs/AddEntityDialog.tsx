import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { orpcClient } from '../lib/orpcClient';
import { ApiError } from '../lib/http';
import { Banner } from '../components/Banner';
import { EntityFormFields } from '../components/EntityFormFields';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { useWorkspaceAuthorization } from '../auth/WorkspaceAuthorizationContext';
import { useEntitiesBySchema } from '../hooks/useEntities';
import styles from './AddEntityDialog.module.css';
import {
  EntitySchema,
  isReferenceOrContainmentField
} from '@arch-register/api-types/schemaContract';
import type { FieldGroupAccess } from '@arch-register/permissions';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import {
  applyEntityTemplate,
  createEntityFormDefaults,
  type EntityFormDefaults
} from '../lib/entityTemplates';
import type { EntityEditState } from '../lib/entityEditState';
import { useAutoFocus } from '../hooks/useAutoFocus';
import { resolveGroupAccessControl } from '../lib/fieldGroupAccess';

type EntityApiResponse = {
  _uid: string;
  _publicId: string;
  [key: string]: unknown;
};

// The form is one flat edit state (the same shape the change case editor uses): metadata under
// `_`-prefixed keys, schema fields under their field id.
const toFormState = (name: string, defaults: EntityFormDefaults): EntityEditState => ({
  ...defaults.fields,
  _name: name,
  _description: defaults.meta.description,
  _owner: defaults.meta.owner,
  _lifecycle: defaults.meta.lifecycle,
  _namespace: defaults.meta.namespace,
  _tags: defaults.meta.tags
});

type AddEntityDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (entity: EntityApiResponse) => void;
  onDraftCreated?: (state: Record<string, unknown>) => void;
  draftMode?: boolean;
  referenceOptionsExtra?: Record<string, EntitySummary[]>;
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
  onDraftCreated,
  draftMode = false,
  referenceOptionsExtra,
  workspaceId,
  schemas,
  lifecycleStates,
  teams,
  preselectedSchemaId
}: AddEntityDialogProps) => {
  const { canCreateTopLevelEntity, getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  const [schemaId, setSchemaId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templateWarnings, setTemplateWarnings] = useState<string[]>([]);
  const [form, setForm] = useState<EntityEditState>(() =>
    toFormState('', createEntityFormDefaults())
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useAutoFocus(nameRef, { enabled: open });
  const creatableTeams = useMemo(
    () => teams.filter(team => canCreateTopLevelEntity(team.id)),
    [canCreateTopLevelEntity, teams]
  );
  const canCreateWithoutOwner = canCreateTopLevelEntity(null);

  useEffect(() => {
    if (open) {
      const initial = preselectedSchemaId ?? schemas[0]?.id ?? '';
      setSchemaId(initial);
      const baseline = createEntityFormDefaults(
        canCreateWithoutOwner ? '' : (creatableTeams[0]?.id ?? '')
      );
      setTemplateId('');
      setTemplateWarnings([]);
      setForm(toFormState('', baseline));
      setError('');
    }
  }, [canCreateWithoutOwner, creatableTeams, open, preselectedSchemaId, schemas]);

  const selectedSchema = schemas.find(s => s.id === schemaId);

  const fieldAccessById = useMemo(() => {
    if (!selectedSchema) return new Map<string, FieldGroupAccess>();
    const groupAccessById = new Map(
      selectedSchema.groups.map(group => [
        group.id,
        getFieldGroupAccess(
          resolveGroupAccessControl(group, selectedSchema.shared_field_group_links ?? [])
        )
      ])
    );
    return new Map<string, FieldGroupAccess>(
      selectedSchema.fields.map(f => [
        f.id,
        f.groupId ? (groupAccessById.get(f.groupId) ?? 'edit') : 'edit'
      ])
    );
  }, [selectedSchema, getFieldGroupAccess]);

  const targetSchemaIds = useMemo(() => {
    if (!selectedSchema) return [];
    return [
      ...new Set(
        selectedSchema.fields
          .filter(isReferenceOrContainmentField)
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
    for (const [schemaId, extra] of Object.entries(referenceOptionsExtra ?? {})) {
      nextOptions[schemaId] = [...(nextOptions[schemaId] ?? []), ...extra];
    }
    return nextOptions;
  }, [open, targetSchemaIds, entitiesQueries, referenceOptionsExtra]);

  useEffect(() => {
    if (!templateId || !selectedSchema || entitiesQueries.some(query => query.isPending)) return;
    const relationshipFields = selectedSchema.fields.filter(isReferenceOrContainmentField);
    const template = selectedSchema.templates.find(item => item.id === templateId);
    const removedLabels = relationshipFields.flatMap(field => {
      const value = template?.values.fields[field.id];
      if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string'))
        return [];
      const available = new Set(
        (derivedReferenceOptions[field.schemaId] ?? []).map(entity => entity._uid)
      );
      return value.some(id => !available.has(id))
        ? [`${field.name} contains unavailable entities`]
        : [];
    });
    setForm(current => {
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
    // The name is typed independently of the template, so it survives a template change.
    const keepName = (applied: EntityFormDefaults) =>
      setForm(current => toFormState((current['_name'] as string) ?? '', applied));
    if (!schema || !nextTemplateId) {
      keepName(baseline);
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
    keepName(applied);
    setTemplateWarnings(applied.warnings);
  };

  const handleSubmit = async () => {
    if (!schemaId) {
      setError('Please select a schema type');
      return;
    }
    const entityName = ((form['_name'] as string) ?? '').trim();
    if (!entityName) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    const dataFields: Record<string, unknown> = {};
    if (selectedSchema) {
      for (const f of selectedSchema.fields) {
        if (fieldAccessById.get(f.id) === 'none') continue;
        if (f.type === 'typedRelation') continue;
        const val = form[f.id];
        const isEmptyArray = Array.isArray(val) && val.length === 0;
        if (val !== undefined && val !== '' && !isEmptyArray) {
          if (f.type === 'boolean') {
            dataFields[f.id] = val === true || val === 'true';
          } else if (f.type === 'number') {
            dataFields[f.id] = Number(val);
          } else {
            dataFields[f.id] = val;
          }
        }
      }
    }

    const tags = ((form['_tags'] as string) ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const owner = ((form['_owner'] as string) ?? '').trim();
    const lifecycle = (form['_lifecycle'] as string) ?? '';
    const namespace = ((form['_namespace'] as string) ?? '').trim();

    const body = {
      _schemaId: schemaId,
      _name: entityName,
      _description: ((form['_description'] as string) ?? '').trim(),
      _owner: owner === '' ? null : owner,
      _lifecycle: lifecycle === '' ? null : lifecycle,
      _namespace: namespace === '' ? 'default' : namespace,
      _tags: tags,
      _links: [],
      ...dataFields
    };

    if (draftMode) {
      onDraftCreated?.({
        schema_id: schemaId,
        name: entityName,
        slug: entityName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        namespace: body._namespace,
        description: body._description,
        owner: body._owner,
        lifecycle: body._lifecycle,
        target_lifecycle: null,
        target_lifecycle_date: null,
        tags,
        links: body._links,
        data: dataFields
      });
      onClose();
      setSubmitting(false);
      return;
    }

    try {
      const entity = await orpcClient.entities.create({
        params: { workspace: workspaceId },
        body
      });
      onCreated?.(entity);
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
      width="min(640px, calc(100vw - 48px))"
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
                value={schemaId ?? undefined}
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
                value={templateId ?? '__none__'}
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

        <EntityFormFields
          workspaceId={workspaceId}
          schema={selectedSchema ?? null}
          state={form}
          setState={updater => setForm(updater)}
          teams={creatableTeams}
          lifecycleStates={lifecycleStates}
          referenceOptions={derivedReferenceOptions}
          fieldAccessById={fieldAccessById}
          showNamespaceAndTags
          nameRequired
          allowNoOwner={canCreateWithoutOwner}
          nameRef={nameRef}
        />

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
