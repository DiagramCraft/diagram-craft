import { useState } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { ListEditor } from '../../../components/ListEditor';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationRecordDraft } from '@arch-register/api-types/entityContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import { relationIds, type TypedRelationFieldEditState } from '../../../lib/entityEditState';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
import { useTeams, useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  RelationFieldInput,
  isMultiValuedRelationSelectField
} from '../../../dialogs/RelationFieldInput';
import { groupRelationFields } from '../../../lib/relationFieldGroups';
import { RelationFieldGroupSection } from '../../../components/RelationFieldGroupSection';
import { KEY_FIELD_COUNT, formatRelationFieldValue } from './RelationRecordList';
import sharedStyles from '../EntityDetailScreen.module.css';
import styles from './EntityRelationsTab.module.css';

const toRelationFieldValue = (
  field: RelationSchema['fields'][number],
  value: string | string[]
): unknown => {
  if (field.type === 'entityRelation' || isMultiValuedRelationSelectField(field)) {
    return relationIds(value);
  }
  if (value === '') return null;
  if (field.type === 'boolean') return value === 'true';
  if (field.type === 'number') return Number(value);
  return value;
};

const pendingFieldValue = (
  pendingUpdate: Record<string, unknown> | undefined,
  fieldId: string,
  fallback: unknown
) =>
  pendingUpdate !== undefined && Object.hasOwn(pendingUpdate, fieldId)
    ? pendingUpdate[fieldId]
    : fallback;

type RelationEntry =
  | { kind: 'existing'; id: string; record: RelationRecord }
  | { kind: 'draft'; id: string; draft: RelationRecordDraft; index: number };

type Props = {
  workspaceId: string;
  field: TypedRelationField;
  relationSchema: RelationSchema | undefined;
  existingRecords: RelationRecord[];
  fieldState: TypedRelationFieldEditState;
  disabled?: boolean;
  onCreate: (draft: RelationRecordDraft) => void;
  onRemoveDraft: (index: number) => void;
  onUpdateField: (relationUid: string, fieldId: string, value: unknown) => void;
  onToggleRemove: (relationUid: string) => void;
};

export const TypedRelationFieldEditor = ({
  workspaceId,
  field,
  relationSchema,
  existingRecords,
  fieldState,
  disabled,
  onCreate,
  onRemoveDraft,
  onUpdateField,
  onToggleRemove
}: Props) => {
  const [adding, setAdding] = useState(false);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [draftEntityNames, setDraftEntityNames] = useState<Record<string, string>>({});
  const { schemas } = useWorkspaceContext();
  const direction = field.direction === 'in' ? 'outgoing' : 'incoming';
  const otherEndpoint = field.direction === 'in' ? 'out' : 'in';
  const otherEndpointSchemaIds = relationSchema?.[otherEndpoint].schemaIds;
  const otherSchemaIds =
    otherEndpointSchemaIds === 'any'
      ? schemas.map(schema => schema.id)
      : (otherEndpointSchemaIds ?? []);
  const otherEntityQueries = useEntitiesBySchema(workspaceId, adding ? otherSchemaIds : []);
  const otherEntityCandidates = otherEntityQueries.flatMap(query => query.data ?? []);
  const { data: teams = [] } = useTeams(workspaceId, expandedUid != null || adding);
  const { data: lifecycleStates = [] } = useLifecycleStates(
    workspaceId,
    expandedUid != null || adding
  );

  const activeFields = (relationSchema?.fields ?? []).filter(f => !f.archived);
  const activeFieldGroups = groupRelationFields(activeFields, relationSchema?.groups);
  const activeExistingCount = existingRecords.filter(
    record => !fieldState.remove.has(record._uid)
  ).length;
  const currentCount = activeExistingCount + fieldState.create.length;
  const atMinimum = currentCount <= field.minCount;
  const atMaximum = field.maxCount !== -1 && currentCount >= field.maxCount;
  const entries: RelationEntry[] = [
    ...existingRecords.map(
      (record): RelationEntry => ({ kind: 'existing', id: record._uid, record })
    ),
    ...fieldState.create.map(
      (draft, index): RelationEntry => ({ kind: 'draft', id: `draft-${index}`, draft, index })
    )
  ];

  return (
    // The parent .propValue is a flex row (`align-items: center`, no stretch), so without an
    // explicit width this whole editor — and each record's card border below — shrinks to fit
    // its content instead of filling the available row width.
    <div style={{ width: '100%' }}>
      <div className={sharedStyles.dim} style={{ marginBottom: 8 }}>
        {currentCount} relation{currentCount === 1 ? '' : 's'} · minimum {field.minCount} · maximum{' '}
        {field.maxCount === -1 ? 'unlimited' : field.maxCount}
      </div>
      <ListEditor<RelationEntry>
        layout="card"
        header="none"
        items={entries}
        getId={entry => entry.id}
        addLabel="Add"
        emptyMessage="No relations"
        disabled={disabled}
        addDisabled={atMaximum}
        addControl={adding ? false : undefined}
        onAdd={() => setAdding(true)}
        onMove={() => undefined}
        canRemove={entry =>
          entry.kind === 'draft'
            ? currentCount > field.minCount
            : !fieldState.remove.has(entry.record._uid) && !atMinimum
        }
        onRemove={entry =>
          entry.kind === 'draft' ? onRemoveDraft(entry.index) : onToggleRemove(entry.record._uid)
        }
        itemClassName={entry =>
          entry.kind === 'existing' && fieldState.remove.has(entry.record._uid)
            ? (styles.relationRemoved ?? '')
            : ''
        }
        renderActions={entry =>
          entry.kind === 'existing' && fieldState.remove.has(entry.record._uid) ? (
            <Button variant="ghost" onClick={() => onToggleRemove(entry.record._uid)}>
              Undo
            </Button>
          ) : null
        }
        renderItem={entry => {
          if (entry.kind === 'draft') {
            const { draft } = entry;
            return (
              <span className={styles.relationLead}>
                <TbChevronRight size={10} className={sharedStyles.dim} />
                <span style={{ color: 'var(--base-fg)', fontWeight: 500 }}>
                  {draftEntityNames[draft.otherEntityId] ??
                    otherEntityCandidates.find(e => e._uid === draft.otherEntityId)?._name ??
                    otherEntityCandidates.find(e => e._uid === draft.otherEntityId)?._slug ??
                    draft.otherEntityId}
                </span>
              </span>
            );
          }
          const { record } = entry;
          const removed = fieldState.remove.has(record._uid);
          const otherEndpointInfo = direction === 'outgoing' ? record._out : record._in;
          const pendingUpdate = fieldState.update.get(record._uid);
          const expanded = expandedUid === record._uid;
          const fieldSummaries = activeFields
            .slice(0, KEY_FIELD_COUNT)
            .map(f => {
              const value = pendingFieldValue(pendingUpdate, f.id, record[f.id]);
              const formatted = formatRelationFieldValue(f, value);
              return formatted !== null ? `${f.name}: ${formatted}` : null;
            })
            .filter((v): v is string => v !== null);
          return (
            // Not `styles.relation` — that class carries its own border/background, which would
            // look like a second, inner card inside the ListEditor item.
            <button
              type="button"
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: removed ? 'default' : 'pointer',
                font: 'inherit',
                color: 'inherit'
              }}
              disabled={removed}
              onClick={() => setExpandedUid(expanded ? null : record._uid)}
            >
              <span className={styles.relationLead}>
                <TbChevronRight
                  size={10}
                  className={sharedStyles.dim}
                  style={{
                    transform: expanded ? 'rotate(90deg)' : undefined,
                    transition: 'transform 0.1s ease'
                  }}
                />
                {/* Plain text, not a navigation link — in edit mode a click here should expand
                    this row's fields, not carry the user away to the other entity. */}
                <span style={{ color: 'var(--base-fg)', fontWeight: 500, minWidth: 0 }}>
                  {otherEndpointInfo.name}
                </span>
                {!expanded && fieldSummaries.length > 0 && (
                  <span className={sharedStyles.tertiary}> {fieldSummaries.join(' · ')}</span>
                )}
              </span>
            </button>
          );
        }}
        renderFooter={entry => {
          if (entry.kind !== 'existing') return null;
          const { record } = entry;
          const removed = fieldState.remove.has(record._uid);
          const pendingUpdate = fieldState.update.get(record._uid);
          if (expandedUid !== record._uid || removed || disabled) return null;
          return (
            <div style={{ padding: '8px 10px 8px 16px' }}>
              <div style={{ marginBottom: 8 }}>
                <FormElement label="Owner">
                  <Select.Root
                    value={
                      (String(
                        pendingFieldValue(pendingUpdate, '_owner', record._owner?.id) ?? ''
                      ) || undefined) as string | undefined
                    }
                    disabled={!record.canAdmin}
                    onChange={value => onUpdateField(record._uid, '_owner', value ?? '')}
                    placeholder="—"
                    style={{ width: '100%' }}
                  >
                    {teams.map(team => (
                      <Select.Item key={team.id} value={team.id}>
                        {team.name}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </FormElement>
              </div>
              <div style={{ marginBottom: 8 }}>
                <FormElement label="Lifecycle">
                  <Select.Root
                    value={
                      (String(
                        pendingFieldValue(pendingUpdate, '_lifecycle', record._lifecycle?.id) ?? ''
                      ) || undefined) as string | undefined
                    }
                    disabled={!record.canEdit}
                    onChange={value => onUpdateField(record._uid, '_lifecycle', value ?? '')}
                    placeholder="—"
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
              {activeFieldGroups.map((segment, index) => {
                const wrapperStyle = {
                  marginBottom: index < activeFieldGroups.length - 1 ? 8 : 0
                };
                const inputs = segment.fields.map(f => (
                  <RelationFieldInput
                    key={f.id}
                    workspaceId={workspaceId}
                    field={f}
                    value={
                      f.type === 'entityRelation' || isMultiValuedRelationSelectField(f)
                        ? relationIds(pendingFieldValue(pendingUpdate, f.id, record[f.id]))
                        : String(pendingFieldValue(pendingUpdate, f.id, record[f.id]) ?? '')
                    }
                    onChange={value =>
                      onUpdateField(record._uid, f.id, toRelationFieldValue(f, value))
                    }
                  />
                ));
                return segment.group ? (
                  <div key={segment.group.id} style={wrapperStyle}>
                    <RelationFieldGroupSection
                      name={segment.group.name}
                      description={segment.group.description}
                    >
                      {inputs}
                    </RelationFieldGroupSection>
                  </div>
                ) : (
                  <div key={segment.fields[0]!.id} style={wrapperStyle}>
                    {inputs}
                  </div>
                );
              })}
            </div>
          );
        }}
      />

      {!disabled && adding && (
        <NewRelationDraftForm
          workspaceId={workspaceId}
          fields={activeFields}
          groups={relationSchema?.groups}
          candidates={otherEntityCandidates}
          teams={teams}
          lifecycleStates={lifecycleStates}
          onCancel={() => setAdding(false)}
          onConfirm={draft => {
            const entity = otherEntityCandidates.find(e => e._uid === draft.otherEntityId);
            if (entity) {
              setDraftEntityNames(names => ({
                ...names,
                [entity._uid]: entity._name ?? entity._slug
              }));
            }
            onCreate(draft);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
};

const NewRelationDraftForm = ({
  workspaceId,
  fields,
  groups,
  candidates,
  teams,
  lifecycleStates,
  onCancel,
  onConfirm
}: {
  workspaceId: string;
  fields: RelationSchema['fields'];
  groups: RelationSchema['groups'] | undefined;
  candidates: { _uid: string; _name?: string | null; _slug: string }[];
  teams: WorkspaceOwnerOption[];
  lifecycleStates: WorkspaceLifecycleState[];
  onCancel: () => void;
  onConfirm: (draft: RelationRecordDraft) => void;
}) => {
  const [otherEntityId, setOtherEntityId] = useState('');
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [owner, setOwner] = useState('');
  const [lifecycle, setLifecycle] = useState('');

  const setField = (id: string, value: string | string[]) =>
    setValues(v => ({ ...v, [id]: value }));

  const confirm = () => {
    if (!otherEntityId) return;
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const val = values[f.id];
      if (f.type === 'entityRelation' || isMultiValuedRelationSelectField(f)) {
        const ids = relationIds(val);
        if (ids.length > 0) data[f.id] = ids;
        continue;
      }
      if (val === undefined || val === '') continue;
      if (f.type === 'boolean') data[f.id] = val === 'true';
      else if (f.type === 'number') data[f.id] = Number(val);
      else data[f.id] = val;
    }
    // Owner/lifecycle default-copy from the "in" entity server-side when omitted — only send an
    // explicit override when the user actually picked one (#2708).
    if (owner !== '') data['_owner'] = owner;
    if (lifecycle !== '') data['_lifecycle'] = lifecycle;
    onConfirm({ otherEntityId, data });
  };

  return (
    <div
      style={{
        border: '1px solid var(--panel-border)',
        borderRadius: 4,
        padding: '16px 18px 12px 24px',
        background: 'var(--base-bg)'
      }}
    >
      <Select.Root
        value={otherEntityId || undefined}
        onChange={value => setOtherEntityId(value ?? '')}
        placeholder="Select an entity"
        style={{ width: '100%', marginBottom: 16 }}
      >
        {candidates.map(entity => (
          <Select.Item key={entity._uid} value={entity._uid}>
            {entity._name ?? entity._slug}
          </Select.Item>
        ))}
      </Select.Root>
      <div style={{ marginBottom: 8 }}>
        <FormElement label="Owner">
          <Select.Root
            value={owner || undefined}
            onChange={value => setOwner(value ?? '')}
            placeholder="Defaults to the selected entity's owner"
            style={{ width: '100%' }}
          >
            {teams.map(team => (
              <Select.Item key={team.id} value={team.id}>
                {team.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
      </div>
      <div style={{ marginBottom: 8 }}>
        <FormElement label="Lifecycle">
          <Select.Root
            value={lifecycle || undefined}
            onChange={value => setLifecycle(value ?? '')}
            placeholder="Defaults to the selected entity's lifecycle"
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
      {groupRelationFields(fields, groups).map(segment => {
        const inputs = segment.fields.map(f => (
          <RelationFieldInput
            key={f.id}
            workspaceId={workspaceId}
            field={f}
            value={
              values[f.id] ??
              (f.type === 'entityRelation' || isMultiValuedRelationSelectField(f) ? [] : '')
            }
            onChange={value => setField(f.id, value)}
          />
        ));
        return (
          <div key={segment.group?.id ?? segment.fields[0]!.id} style={{ marginBottom: 8 }}>
            {segment.group ? (
              <RelationFieldGroupSection
                name={segment.group.name}
                description={segment.group.description}
              >
                {inputs}
              </RelationFieldGroupSection>
            ) : (
              inputs
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        <Button onClick={onCancel} style={{ marginLeft: 'auto' }}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!otherEntityId} onClick={confirm}>
          Add
        </Button>
      </div>
    </div>
  );
};
