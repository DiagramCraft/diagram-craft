import { useState } from 'react';
import { TbChevronRight, TbPlus, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationRecordDraft } from '@arch-register/api-types/entityContract';
import type { TypedRelationFieldEditState } from '../../../lib/entityEditState';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
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
              border: '1px solid var(--base-border)',
              borderRadius: 4,
              padding: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className={styles.relation}
                style={{ flex: 1, textAlign: 'left' }}
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
                  <span className={styles.relationName}>{otherEndpointInfo.name}</span>
                  {!expanded && fieldSummaries.length > 0 && (
                    <span className={sharedStyles.dim}> · {fieldSummaries.join(' · ')}</span>
                  )}
                </span>
              </button>
              {!disabled && (
                <Button variant="ghost" onClick={() => onToggleRemove(record._uid)}>
                  {removed ? 'Undo' : <TbX size={12} />}
                </Button>
              )}
            </div>
            {expanded && !removed && !disabled && (
              <div style={{ padding: '8px 0 0 16px' }}>
                {activeFields.map(f => (
                  <RelationFieldInput
                    key={f.id}
                    field={f}
                    value={String(pendingUpdate?.[f.id] ?? record[f.id] ?? '')}
                    onChange={value => onUpdateField(record._uid, f.id, value)}
                  />
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
              <TbX size={12} />
            </Button>
          )}
        </div>
      ))}

      {!disabled &&
        (adding ? (
          <NewRelationDraftForm
            fields={activeFields}
            candidates={otherEntityCandidates}
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
  fields,
  candidates,
  onCancel,
  onConfirm
}: {
  fields: RelationSchema['fields'];
  candidates: { _uid: string; _name?: string | null; _slug: string }[];
  onCancel: () => void;
  onConfirm: (draft: RelationRecordDraft) => void;
}) => {
  const [otherEntityId, setOtherEntityId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const setField = (id: string, value: string) => setValues(v => ({ ...v, [id]: value }));

  const confirm = () => {
    if (!otherEntityId) return;
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const val = values[f.id];
      if (val === undefined || val === '') continue;
      if (f.type === 'boolean') data[f.id] = val === 'true';
      else if (f.type === 'number') data[f.id] = Number(val);
      else data[f.id] = val;
    }
    onConfirm({ otherEntityId, data });
  };

  return (
    <div style={{ border: '1px solid var(--base-border)', borderRadius: 4, padding: 8 }}>
      <Select.Root
        value={otherEntityId || undefined}
        onChange={value => setOtherEntityId(value ?? '')}
        placeholder="Select an entity"
        style={{ width: '100%', marginBottom: 6 }}
      >
        {candidates.map(entity => (
          <Select.Item key={entity._uid} value={entity._uid}>
            {entity._name ?? entity._slug}
          </Select.Item>
        ))}
      </Select.Root>
      {fields.map(f => (
        <RelationFieldInput
          key={f.id}
          field={f}
          value={values[f.id] ?? ''}
          onChange={value => setField(f.id, value)}
        />
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!otherEntityId} onClick={confirm}>
          Add
        </Button>
      </div>
    </div>
  );
};
