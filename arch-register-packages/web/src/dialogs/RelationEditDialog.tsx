import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { LoadingState } from '../components/LoadingState';
import { useRelation, useUpdateRelation } from '../hooks/useRelations';
import { useRelationSchemas } from '../hooks/useRelationSchemas';
import { RelationFieldInput } from './RelationFieldInput';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  relationId: string | null;
};

const activeFieldsOf = (schema: RelationSchema | undefined): RelationSchema['fields'] =>
  (schema?.fields ?? []).filter(f => !f.archived);

const toFieldValue = (field: RelationSchema['fields'][number], raw: string): unknown => {
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
  const relationSchema = relationSchemas?.find(schema => schema.id === record?._schema.id);
  const activeFields = activeFieldsOf(relationSchema);
  const updateMutation = useUpdateRelation(workspaceId);

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !record) return;
    const fields = activeFieldsOf(relationSchemas?.find(schema => schema.id === record._schema.id));
    const initial: Record<string, string> = {};
    for (const field of fields) initial[field.id] = String(record[field.id] ?? '');
    setValues(initial);
  }, [open, record, relationSchemas]);

  const handleSave = async () => {
    if (!record) return;
    const data: Record<string, unknown> = {};
    for (const field of activeFields) {
      const raw = values[field.id] ?? '';
      if (raw === String(record[field.id] ?? '')) continue;
      data[field.id] = toFieldValue(field, raw);
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
      ) : activeFields.length === 0 ? (
        <div className="dim">This relation type has no editable fields.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeFields.map(field => (
            <RelationFieldInput
              key={field.id}
              field={field}
              value={values[field.id] ?? ''}
              onChange={value => setValues(v => ({ ...v, [field.id]: value }))}
            />
          ))}
        </div>
      )}
    </Dialog>
  );
};
