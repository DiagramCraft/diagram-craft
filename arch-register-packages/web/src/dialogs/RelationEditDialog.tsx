import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { LoadingState } from '../components/LoadingState';
import { useRelation, useUpdateRelation } from '../hooks/useRelations';
import { useRelationSchemas } from '../hooks/useRelationSchemas';
import { useTeams, useLifecycleStates } from '../hooks/useWorkspaceConfig';
import { RelationFieldInput } from './RelationFieldInput';
import { relationIds } from '../lib/entityEditState';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  relationId: string | null;
};

const activeFieldsOf = (schema: RelationSchema | undefined): RelationSchema['fields'] =>
  (schema?.fields ?? []).filter(f => !f.archived);

const initialFieldValue = (
  field: RelationSchema['fields'][number],
  record: Record<string, unknown>
): string | string[] =>
  field.type === 'entityRelation' ? relationIds(record[field.id]) : String(record[field.id] ?? '');

const fieldValueChanged = (
  field: RelationSchema['fields'][number],
  next: string | string[],
  record: Record<string, unknown>
): boolean => {
  if (field.type === 'entityRelation') {
    const nextIds = relationIds(next);
    const prevIds = relationIds(record[field.id]);
    return nextIds.length !== prevIds.length || nextIds.some((id, i) => id !== prevIds[i]);
  }
  return next !== String(record[field.id] ?? '');
};

const toFieldValue = (field: RelationSchema['fields'][number], raw: string | string[]): unknown => {
  if (field.type === 'entityRelation') return relationIds(raw);
  if (raw === '') return null;
  if (field.type === 'boolean') return raw === 'true';
  if (field.type === 'number') return Number(raw);
  return raw;
};

// Standalone edit dialog for a relation instance's own field values (#2699) — reuses the same
// RelationFieldInput used by the entity-embedded relation editor (TypedRelationFieldEditor.tsx),
// but talks directly to useUpdateRelation instead of going through the entity edit-form's
// draft/batch mutation flow, since here there's no surrounding entity form to batch into.
export const RelationEditDialog = ({ open, onClose, workspaceId, relationId }: Props) => {
  const { data: record } = useRelation(workspaceId, relationId ?? '');
  const { data: relationSchemas } = useRelationSchemas(workspaceId, open && !!relationId);
  const { data: teams = [] } = useTeams(workspaceId, open);
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceId, open);
  const relationSchema = relationSchemas?.find(schema => schema.id === record?._schema.id);
  const activeFields = activeFieldsOf(relationSchema);
  const updateMutation = useUpdateRelation(workspaceId);

  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [owner, setOwner] = useState('');
  const [lifecycle, setLifecycle] = useState('');

  useEffect(() => {
    if (!open || !record) return;
    const fields = activeFieldsOf(relationSchemas?.find(schema => schema.id === record._schema.id));
    const initial: Record<string, string | string[]> = {};
    for (const field of fields) initial[field.id] = initialFieldValue(field, record);
    setValues(initial);
    setOwner(record._owner?.id ?? '');
    setLifecycle(record._lifecycle?.id ?? '');
  }, [open, record, relationSchemas]);

  const handleSave = async () => {
    if (!record) return;
    const data: Record<string, unknown> = {};
    for (const field of activeFields) {
      const raw = values[field.id] ?? (field.type === 'entityRelation' ? [] : '');
      if (!fieldValueChanged(field, raw, record)) continue;
      data[field.id] = toFieldValue(field, raw);
    }
    if (record.canAdmin && owner !== (record._owner?.id ?? '')) {
      data['_owner'] = owner === '' ? null : owner;
    }
    if (record.canEdit && lifecycle !== (record._lifecycle?.id ?? '')) {
      data['_lifecycle'] = lifecycle === '' ? null : lifecycle;
    }
    if (Object.keys(data).length > 0) {
      try {
        await updateMutation.mutateAsync({ relationId: record._uid, data });
      } catch {
        return;
      }
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit relation"
      sub={relationSchema?.name}
      width="min(480px, calc(100vw - 48px))"
      buttons={[
        { label: 'Cancel', type: 'secondary', onClick: onClose },
        {
          label: 'Save',
          type: 'default',
          onClick: handleSave,
          disabled: !record || updateMutation.isPending
        }
      ]}
    >
      {!record ? (
        <LoadingState text="Loading relation..." size="sm" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormElement label="Owner">
            <Select.Root
              value={owner || undefined}
              disabled={!record.canAdmin}
              onChange={next => setOwner(next ?? '')}
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
          <FormElement label="Lifecycle">
            <Select.Root
              value={lifecycle || undefined}
              disabled={!record.canEdit}
              onChange={next => setLifecycle(next ?? '')}
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
          {activeFields.length === 0 ? (
            <div className="dim">This relation type has no other editable fields.</div>
          ) : (
            activeFields.map(field => (
              <RelationFieldInput
                key={field.id}
                workspaceId={workspaceId}
                field={field}
                value={values[field.id] ?? (field.type === 'entityRelation' ? [] : '')}
                onChange={value => setValues(v => ({ ...v, [field.id]: value }))}
              />
            ))
          )}
        </div>
      )}
    </Dialog>
  );
};
