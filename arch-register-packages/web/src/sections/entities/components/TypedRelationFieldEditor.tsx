import { useState } from 'react';
import { TbChevronRight, TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
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
import { RelationFieldInput } from '../../../dialogs/RelationFieldInput';
import { KEY_FIELD_COUNT, formatRelationFieldValue } from './RelationRecordList';
import sharedStyles from '../EntityDetailScreen.module.css';
import styles from './EntityRelationsTab.module.css';

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
  const direction = field.direction === 'out' ? 'outgoing' : 'incoming';
  const otherEndpoint = field.direction === 'out' ? 'in' : 'out';
  const otherSchemaIds = relationSchema?.[otherEndpoint].schemaIds ?? [];
  const otherEntityQueries = useEntitiesBySchema(workspaceId, adding ? otherSchemaIds : []);
  const otherEntityCandidates = otherEntityQueries.flatMap(query => query.data ?? []);
  const { data: teams = [] } = useTeams(workspaceId, expandedUid != null || adding);
  const { data: lifecycleStates = [] } = useLifecycleStates(
    workspaceId,
    expandedUid != null || adding
  );

  const activeFields = (relationSchema?.fields ?? []).filter(f => !f.archived);

  return (
    // The parent .propValue is a flex row (`align-items: center`, no stretch), so without an
    // explicit width this whole editor — and each record's card border below — shrinks to fit
    // its content instead of filling the available row width.
    <div style={{ width: '100%' }}>
      {existingRecords.map(record => {
        const removed = fieldState.remove.has(record._uid);
        const otherEndpointInfo = direction === 'outgoing' ? record._out : record._in;
        const pendingUpdate = fieldState.update.get(record._uid);
        const expanded = expandedUid === record._uid;
        const fieldSummaries = activeFields
          .slice(0, KEY_FIELD_COUNT)
          .map(f => {
            const value = pendingUpdate?.[f.id] ?? record[f.id];
            const formatted = formatRelationFieldValue(f, value);
            return formatted !== null ? `${f.name}: ${formatted}` : null;
          })
          .filter((v): v is string => v !== null);
        return (
          <div
            key={record._uid}
            style={{
              marginBottom: 6,
              opacity: removed ? 0.5 : 1,
              border: '1px solid var(--panel-border)',
              borderRadius: 4,
              padding: 8,
              background: 'var(--base-bg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Not `styles.relation` — that class carries its own border/background, which
                  would look like a second, inner card competing with the one wrapping this
                  whole row (header + expanded form). Plain/unstyled here so there's only one. */}
              <button
                type="button"
                style={{
                  flex: 1,
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
                      this row's fields, not carry the user away to the other entity. Not
                      `styles.relationName` either: that class's hover-underline signals "this is
                      a link", which is no longer true here. */}
                  <span style={{ color: 'var(--base-fg)', fontWeight: 500, minWidth: 0 }}>
                    {otherEndpointInfo.name}
                  </span>
                  {!expanded && fieldSummaries.length > 0 && (
                    <span className={sharedStyles.dim}> {fieldSummaries.join(' · ')}</span>
                  )}
                </span>
              </button>
              {!disabled && (
                <Button variant="ghost" onClick={() => onToggleRemove(record._uid)}>
                  {removed ? 'Undo' : <TbTrash size={12} />}
                </Button>
              )}
            </div>
            {expanded && !removed && !disabled && (
              <div style={{ padding: '8px 10px 8px 16px' }}>
                <div style={{ marginBottom: 8 }}>
                  <FormElement label="Owner">
                    <Select.Root
                      value={
                        (String(pendingUpdate?.['_owner'] ?? record._owner?.id ?? '') ||
                          undefined) as string | undefined
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
                        (String(pendingUpdate?.['_lifecycle'] ?? record._lifecycle?.id ?? '') ||
                          undefined) as string | undefined
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
                {activeFields.map((f, index) => (
                  <div key={f.id} style={{ marginBottom: index < activeFields.length - 1 ? 8 : 0 }}>
                    <RelationFieldInput
                      workspaceId={workspaceId}
                      field={f}
                      value={
                        f.type === 'entityRelation'
                          ? relationIds(pendingUpdate?.[f.id] ?? record[f.id])
                          : String(pendingUpdate?.[f.id] ?? record[f.id] ?? '')
                      }
                      onChange={value => onUpdateField(record._uid, f.id, value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {fieldState.create.map((draft, index) => (
        <div
          key={`draft-${index}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
        >
          <span className={sharedStyles.dim} style={{ flex: 1 }}>
            {otherEntityCandidates.find(e => e._uid === draft.otherEntityId)?._name ??
              draft.otherEntityId}
          </span>
          {!disabled && (
            <Button variant="ghost" onClick={() => onRemoveDraft(index)}>
              <TbTrash size={12} />
            </Button>
          )}
        </div>
      ))}

      {!disabled &&
        (adding ? (
          <NewRelationDraftForm
            workspaceId={workspaceId}
            fields={activeFields}
            candidates={otherEntityCandidates}
            teams={teams}
            lifecycleStates={lifecycleStates}
            onCancel={() => setAdding(false)}
            onConfirm={draft => {
              onCreate(draft);
              setAdding(false);
            }}
          />
        ) : (
          <Button variant="ghost" icon={<TbPlus size={11} />} onClick={() => setAdding(true)}>
            Add
          </Button>
        ))}
    </div>
  );
};

const NewRelationDraftForm = ({
  workspaceId,
  fields,
  candidates,
  teams,
  lifecycleStates,
  onCancel,
  onConfirm
}: {
  workspaceId: string;
  fields: RelationSchema['fields'];
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
      if (f.type === 'entityRelation') {
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
      {fields.map(f => (
        <div key={f.id} style={{ marginBottom: 8 }}>
          <RelationFieldInput
            workspaceId={workspaceId}
            field={f}
            value={values[f.id] ?? (f.type === 'entityRelation' ? [] : '')}
            onChange={value => setField(f.id, value)}
          />
        </div>
      ))}
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
