import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { FormGroup } from '@diagram-craft/app-components/FormGroup';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbAdjustments, TbInfoCircle } from 'react-icons/tb';
import type {
  EntitySchema,
  EntityTemplate,
  SchemaField
} from '@arch-register/api-types/schemaContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { Banner } from '../components/Banner';
import { useEntitiesBySchema } from '../hooks/useEntities';
import {
  applyEntityTemplate,
  createEntityFormDefaults,
  toEntityTemplateValues
} from '../lib/entityTemplates';
import { EntityFieldInput } from './EntityFieldInput';
import styles from './AddEntityDialog.module.css';

export const EntityTemplateDialog = ({
  open,
  onClose,
  onSave,
  workspaceId,
  schema,
  template,
  templates,
  teams,
  lifecycleStates
}: {
  open: boolean;
  onClose: () => void;
  onSave: (template: EntityTemplate) => void;
  workspaceId: string;
  schema: EntitySchema;
  template: EntityTemplate | null;
  templates: EntityTemplate[];
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
}) => {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [meta, setMeta] = useState(createEntityFormDefaults().meta);
  const [error, setError] = useState('');

  const targetSchemaIds = useMemo(
    () => [
      ...new Set(
        schema.fields
          .filter(
            (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
              field.type === 'reference' || field.type === 'containment'
          )
          .map(field => field.schemaId)
          .filter(Boolean)
      )
    ],
    [schema.fields]
  );
  const entityQueries = useEntitiesBySchema(workspaceId, open ? targetSchemaIds : []);
  const referenceOptions = useMemo(() => {
    const options: Record<string, NonNullable<(typeof entityQueries)[number]['data']>> = {};
    entityQueries.forEach((query, index) => {
      if (query.data) options[targetSchemaIds[index]!] = query.data;
    });
    return options;
  }, [entityQueries, targetSchemaIds]);

  useEffect(() => {
    if (!open) return;
    const baseline = createEntityFormDefaults();
    setName(template?.name ?? '');
    setError('');
    if (!template) {
      setFields(baseline.fields);
      setMeta(baseline.meta);
      return;
    }
    const applied = applyEntityTemplate({
      baseline,
      schema,
      template,
      allowedOwnerIds: new Set(teams.map(team => team.id)),
      lifecycleIds: new Set(lifecycleStates.map(state => state.id)),
      referenceOptions: {}
    });
    setFields(applied.fields);
    setMeta(applied.meta);
  }, [open, template, schema, teams, lifecycleStates]);

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Template name is required');
      return;
    }
    if (
      templates.some(
        item => item.id !== template?.id && item.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      setError(`A template named "${trimmedName}" already exists`);
      return;
    }
    onSave({
      id: template?.id ?? crypto.randomUUID(),
      name: trimmedName,
      values: toEntityTemplateValues(schema, fields, meta)
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={template ? 'Edit entity template' : 'New entity template'}
      width="min(1040px, calc(100vw - 48px))"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        { label: template ? 'Update template' : 'Add template', type: 'default', onClick: save }
      ]}
    >
      <div className={styles.form}>
        <FormElement label="Template name" required>
          <TextInput
            value={name}
            onChange={value => setName(value ?? '')}
            placeholder="Template name"
            style={{ width: '100%' }}
          />
        </FormElement>
        <div className={styles.contentGrid}>
          <FormGroup label="Properties" icon={<TbAdjustments size={12} />}>
            <div className={styles.propertiesList}>
              {schema.fields
                .filter(field => field.id !== 'name')
                .map(field => (
                  <EntityFieldInput
                    key={field.id}
                    field={field}
                    value={
                      field.type === 'reference' || field.type === 'containment'
                        ? Array.isArray(fields[field.id])
                          ? (fields[field.id] as string[])
                          : []
                        : String(fields[field.id] ?? '')
                    }
                    onChange={value => setFields(current => ({ ...current, [field.id]: value }))}
                    referenceOptions={referenceOptions}
                  />
                ))}
            </div>
          </FormGroup>
          <FormGroup label="Metadata" icon={<TbInfoCircle size={11} />}>
            <FormElement label="Description" required={false}>
              <TextArea
                value={meta.description}
                onChange={value => setMeta(current => ({ ...current, description: value ?? '' }))}
                rows={3}
                style={{ width: '100%' }}
              />
            </FormElement>
            <div className={styles.row}>
              <FormElement label="Owner" required={false}>
                <Select.Root
                  value={meta.owner ?? undefined}
                  onChange={value => setMeta(current => ({ ...current, owner: value ?? '' }))}
                  placeholder="Not set"
                  style={{ width: '100%' }}
                >
                  {teams.map(team => (
                    <Select.Item key={team.id} value={team.id}>
                      {team.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </FormElement>
              <FormElement label="Lifecycle" required={false}>
                <Select.Root
                  value={meta.lifecycle ?? undefined}
                  onChange={value => setMeta(current => ({ ...current, lifecycle: value ?? '' }))}
                  placeholder="Not set"
                  style={{ width: '100%' }}
                >
                  {lifecycleStates.map(state => (
                    <Select.Item key={state.id} value={state.id}>
                      {state.label}
                    </Select.Item>
                  ))}
                </Select.Root>
              </FormElement>
            </div>
            <div className={styles.row}>
              <FormElement label="Namespace" required={false}>
                <TextInput
                  value={meta.namespace}
                  onChange={value => setMeta(current => ({ ...current, namespace: value ?? '' }))}
                  placeholder="default"
                  style={{ width: '100%' }}
                />
              </FormElement>
              <FormElement label="Tags" required={false}>
                <TextInput
                  value={meta.tags}
                  onChange={value => setMeta(current => ({ ...current, tags: value ?? '' }))}
                  placeholder="comma-separated"
                  style={{ width: '100%' }}
                />
              </FormElement>
            </div>
          </FormGroup>
        </div>
        {error && <Banner variant="error">{error}</Banner>}
      </div>
    </Dialog>
  );
};
