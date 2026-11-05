import { useState, type Ref } from 'react';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { FieldGroupAccess } from '@arch-register/permissions';
import { EntityFieldInput } from '../dialogs/EntityFieldInput';
import { useSupportedCurrencies } from '../hooks/useWorkspaceConfig';
import { isMultiValuedScalarField } from '../lib/scalarFieldValues';
import { relationIds, type EntityEditState } from '../lib/entityEditState';
import styles from './EntityFormFields.module.css';

type Field = EntitySchema['fields'][number];

// The edit state keeps booleans/numbers as real values (as stored on the entity), while
// EntityFieldInput edits single-valued booleans and numbers as strings. Strings (e.g. from a
// template prefill) are passed through untouched.
const toInputValue = (field: Field, value: unknown): unknown => {
  if (isReferenceOrContainmentField(field)) return relationIds(value);
  if (isMultiValuedScalarField(field)) return value;
  if (field.type === 'boolean') {
    return typeof value === 'boolean' ? String(value) : typeof value === 'string' ? value : '';
  }
  if (field.type === 'number') return typeof value === 'number' ? String(value) : (value ?? '');
  if (field.type === 'currency' || field.type === 'principal') return value;
  return value ?? '';
};

const fromInputValue = (field: Field, value: unknown): unknown => {
  if (isMultiValuedScalarField(field)) return value;
  if (field.type === 'boolean') return value === 'true' ? true : value === 'false' ? false : '';
  return value;
};

const METADATA_TAB = '__metadata__';

export type EntityFormFieldsProps = {
  workspaceId: string;
  schema: EntitySchema | null;
  state: EntityEditState;
  setState: (updater: (state: EntityEditState) => EntityEditState) => void;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  /** When set, reference and containment fields are editable using these candidates. When
   *  omitted they are skipped (e.g. in a change case, where relations are separate members). */
  referenceOptions?: Record<string, EntitySummary[]>;
  /** Per-field access; `none` hides the field and `view` makes it read-only. */
  fieldAccessById?: Map<string, FieldGroupAccess>;
  /** Show the namespace and tags inputs. */
  showNamespaceAndTags?: boolean;
  nameRequired?: boolean;
  /** Offer a "no owner" choice in the owner select. */
  allowNoOwner?: boolean;
  nameRef?: Ref<HTMLInputElement>;
};

/** The flat entity form (name, description, owner, lifecycle, schema fields) shared by the New
 *  entity dialog and the change case's entity editor. */
export const EntityFormFields = ({
  workspaceId,
  schema,
  state,
  setState,
  teams,
  lifecycleStates,
  referenceOptions,
  fieldAccessById,
  showNamespaceAndTags = false,
  nameRequired = false,
  allowNoOwner = true,
  nameRef
}: EntityFormFieldsProps) => {
  const currencyConfig = useSupportedCurrencies(workspaceId, true);
  const [tab, setTab] = useState(METADATA_TAB);
  const setMeta = (key: string, value: string) => setState(s => ({ ...s, [key]: value }));

  const editableFields = (schema?.fields ?? []).filter(
    f =>
      f.id !== 'name' &&
      f.type !== 'derived' &&
      // typedRelation instances aren't part of the entity's data blob and have no
      // create-flow editor yet (#2606) — set them after creation instead.
      f.type !== 'typedRelation' &&
      (referenceOptions !== undefined || !isReferenceOrContainmentField(f)) &&
      fieldAccessById?.get(f.id) !== 'none'
  );
  // Ungrouped fields first, then one section per schema group in the schema's group order.
  // Groups without any editable field are omitted.
  const groups = schema?.groups ?? [];
  const groupIds = new Set(groups.map(g => g.id));
  const ungrouped = editableFields.filter(f => !f.groupId || !groupIds.has(f.groupId));
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
    ...groups
      .map(g => ({
        id: g.id,
        label: g.name,
        fields: editableFields.filter(f => f.groupId === g.id)
      }))
      .filter(section => section.fields.length > 0)
  ];

  const activeTab =
    tab === METADATA_TAB || fieldSections.some(section => section.id === tab) ? tab : METADATA_TAB;

  return (
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
        <div className={styles.fields}>
          <FormElement label="Name" required={nameRequired}>
            <TextInput
              ref={nameRef}
              value={(state['_name'] as string) ?? ''}
              onChange={v => setMeta('_name', v ?? '')}
              placeholder="Entity name"
            />
          </FormElement>
          <FormElement label="Description" required={false}>
            <TextArea
              value={(state['_description'] as string) ?? ''}
              onChange={v => setMeta('_description', v ?? '')}
              placeholder="Brief description of this entity"
              rows={3}
            />
          </FormElement>
          <FormElement label="Owner" required={false}>
            <Select.Root
              value={(state['_owner'] as string) ?? ''}
              onChange={v => setMeta('_owner', v ?? '')}
              placeholder="—"
            >
              {allowNoOwner && <Select.Item value="">—</Select.Item>}
              {teams.map(t => (
                <Select.Item key={t.id} value={t.id}>
                  {t.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
          <FormElement label="Lifecycle" required={false}>
            <Select.Root
              value={(state['_lifecycle'] as string) ?? ''}
              onChange={v => setMeta('_lifecycle', v ?? '')}
              placeholder="—"
            >
              <Select.Item value="">—</Select.Item>
              {lifecycleStates.map(ls => (
                <Select.Item key={ls.id} value={ls.id}>
                  {ls.label}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
          {showNamespaceAndTags && (
            <>
              <FormElement label="Namespace" required={false}>
                <TextInput
                  value={(state['_namespace'] as string) ?? ''}
                  onChange={v => setMeta('_namespace', v ?? '')}
                  placeholder="default"
                />
              </FormElement>
              <FormElement label="Tags" required={false}>
                <TextInput
                  value={(state['_tags'] as string) ?? ''}
                  onChange={v => setMeta('_tags', v ?? '')}
                  placeholder="comma-separated"
                  style={{ width: '100%' }}
                />
              </FormElement>
            </>
          )}
        </div>
      </Tabs.Content>

      {fieldSections.map(section => (
        <Tabs.Content key={section.id} value={section.id} style={{ minHeight: '400px' }}>
          <div className={styles.fields}>
            {section.fields.map(f => (
              <EntityFieldInput
                key={f.id}
                field={f}
                value={toInputValue(f, state[f.id])}
                onChange={value => setState(s => ({ ...s, [f.id]: fromInputValue(f, value) }))}
                referenceOptions={referenceOptions}
                currencyOptions={currencyConfig.data?.currencies}
                defaultCurrency={currencyConfig.data?.default_currency}
                disabled={fieldAccessById?.get(f.id) === 'view'}
              />
            ))}
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
};
