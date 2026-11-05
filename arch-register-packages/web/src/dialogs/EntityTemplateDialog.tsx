import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import {
  isReferenceOrContainmentField,
  type EntitySchema,
  type EntityTemplate
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
import { useSupportedCurrencies } from '../hooks/useWorkspaceConfig';
import styles from './AddEntityDialog.module.css';
import { useWorkspaceAuthorization } from '../auth/WorkspaceAuthorizationContext';
import { resolveGroupAccessControl } from '../lib/fieldGroupAccess';
import type { FieldGroupAccess } from '@arch-register/permissions';

const METADATA_TAB = '__metadata__';

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
  const currencyConfig = useSupportedCurrencies(workspaceId, open);
  const [name, setName] = useState('');
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [meta, setMeta] = useState(createEntityFormDefaults().meta);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(METADATA_TAB);

  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  const fieldAccessById = useMemo(() => {
    const groupAccessById = new Map(
      schema.groups.map(group => [
        group.id,
        getFieldGroupAccess(resolveGroupAccessControl(group, schema.shared_field_group_links ?? []))
      ])
    );
    return new Map<string, FieldGroupAccess>(
      schema.fields.map(f => [
        f.id,
        f.groupId ? (groupAccessById.get(f.groupId) ?? 'edit') : 'edit'
      ])
    );
  }, [schema, getFieldGroupAccess]);

  const targetSchemaIds = useMemo(
    () => [
      ...new Set(
        schema.fields
          .filter(isReferenceOrContainmentField)
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
    setTab(METADATA_TAB);
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

  const editableFields = schema.fields.filter(
    field =>
      field.id !== 'name' &&
      field.type !== 'derived' &&
      // typedRelation instances aren't part of the entity's data blob and have no
      // create/template-editor UI yet (#2606).
      field.type !== 'typedRelation' &&
      fieldAccessById.get(field.id) !== 'none'
  );
  // Ungrouped fields first, then one tab per schema group; groups without editable fields are omitted.
  const groupIds = new Set(schema.groups.map(group => group.id));
  const ungrouped = editableFields.filter(field => !field.groupId || !groupIds.has(field.groupId));
  const fieldSections = [
    ...(ungrouped.length > 0
      ? [
          {
            id: '__ungrouped__',
            label: 'Entity Fields',
            fields: ungrouped
          }
        ]
      : []),
    ...schema.groups
      .map(group => ({
        id: group.id,
        label: group.name,
        fields: editableFields.filter(field => field.groupId === group.id)
      }))
      .filter(section => section.fields.length > 0)
  ];
  const activeTab =
    tab === METADATA_TAB || fieldSections.some(section => section.id === tab) ? tab : METADATA_TAB;

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
    const templateValues = toEntityTemplateValues(schema, fields, meta);
    for (const fieldId of Object.keys(templateValues.fields)) {
      if (fieldAccessById.get(fieldId) === 'none') delete templateValues.fields[fieldId];
    }
    onSave({
      id: template?.id ?? crypto.randomUUID(),
      name: trimmedName,
      values: templateValues
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={template ? 'Edit entity template' : 'New entity template'}
      scrollable={true}
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
        <Tabs.Root value={activeTab} onValueChange={setTab} autoHeight>
          <Tabs.List overflow>
            <Tabs.Trigger value={METADATA_TAB}>Metadata</Tabs.Trigger>
            {fieldSections.map(section => (
              <Tabs.Trigger key={section.id} value={section.id}>
                {section.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value={METADATA_TAB} style={{ minHeight: '400px' }}>
            <div className={styles.propertiesList}>
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
            </div>
          </Tabs.Content>
          {fieldSections.map(section => (
            <Tabs.Content key={section.id} value={section.id} style={{ minHeight: '400px' }}>
              <div className={styles.propertiesList}>
                {section.fields.map(field => (
                  <EntityFieldInput
                    key={field.id}
                    field={field}
                    value={
                      field.type === 'reference' || field.type === 'containment'
                        ? Array.isArray(fields[field.id])
                          ? (fields[field.id] as string[])
                          : []
                        : field.type === 'currency'
                          ? fields[field.id]
                          : String(fields[field.id] ?? '')
                    }
                    onChange={value => setFields(current => ({ ...current, [field.id]: value }))}
                    referenceOptions={referenceOptions}
                    currencyOptions={currencyConfig.data?.currencies}
                    defaultCurrency={currencyConfig.data?.default_currency}
                    disabled={fieldAccessById.get(field.id) === 'view'}
                  />
                ))}
              </div>
            </Tabs.Content>
          ))}
        </Tabs.Root>
        {error && <Banner variant="error">{error}</Banner>}
      </div>
    </Dialog>
  );
};
