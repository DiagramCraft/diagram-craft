import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceAuthorization } from '../auth/WorkspaceAuthorizationContext';
import {
  useBypassRelationApproval,
  useRelationChangeApproval,
  useResubmitRelationChangeApproval,
  useSubmitRelationChangeApproval
} from '../hooks/useRelationChanges';
import { LoadingState } from '../components/LoadingState';
import { Banner } from '../components/Banner';
import { useRelation, useUpdateRelation } from '../hooks/useRelations';
import { useRelationSchemas } from '../hooks/useRelationSchemas';
import { useTeams, useLifecycleStates } from '../hooks/useWorkspaceConfig';
import { isMultiValuedRelationSelectField } from './RelationFieldInput';
import { RelationFieldsForm } from './RelationFieldsForm';
import { relationIds } from '../lib/entityEditState';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  relationId: string | null;
};

export const activeFieldsOf = (schema: RelationSchema | undefined): RelationSchema['fields'] =>
  (schema?.fields ?? []).filter(f => !f.archived);

export const initialFieldValue = (
  field: RelationSchema['fields'][number],
  record: Record<string, unknown>
): string | string[] =>
  field.type === 'entityRelation' || isMultiValuedRelationSelectField(field)
    ? relationIds(record[field.id])
    : String(record[field.id] ?? '');

export const fieldValueChanged = (
  field: RelationSchema['fields'][number],
  next: string | string[],
  record: Record<string, unknown>
): boolean => {
  if (field.type === 'entityRelation' || isMultiValuedRelationSelectField(field)) {
    const nextIds = relationIds(next);
    const prevIds = relationIds(record[field.id]);
    return nextIds.length !== prevIds.length || nextIds.some((id, i) => id !== prevIds[i]);
  }
  return next !== String(record[field.id] ?? '');
};

export const toFieldValue = (
  field: RelationSchema['fields'][number],
  raw: string | string[]
): unknown => {
  if (field.type === 'entityRelation' || isMultiValuedRelationSelectField(field)) {
    return relationIds(raw);
  }
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
  const rid = relationId ?? '';
  const { canOverrideEntityApproval } = useWorkspaceAuthorization(workspaceId);
  const { data: changeApproval } = useRelationChangeApproval(workspaceId, rid);
  const submitMutation = useSubmitRelationChangeApproval(workspaceId, rid);
  const resubmitMutation = useResubmitRelationChangeApproval(workspaceId, rid);
  const bypassMutation = useBypassRelationApproval(workspaceId, rid);
  const approvalRequired = relationSchema?.relation_approval_policy === 'required';
  const openApproval = changeApproval?.status === 'open' ? changeApproval : null;
  const latestRevision = openApproval?.revisions.at(-1);
  const revisable =
    latestRevision?.status === 'stale' || latestRevision?.status === 'changes_requested';
  const proposalBlocksEdit = approvalRequired && !!openApproval && !revisable;
  const [note, setNote] = useState('');

  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [owner, setOwner] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !record) return;
    const fields = activeFieldsOf(relationSchemas?.find(schema => schema.id === record._schema.id));
    const initial: Record<string, string | string[]> = {};
    const proposed =
      revisable && latestRevision
        ? ((latestRevision.proposedState['data'] as Record<string, unknown> | undefined) ?? {})
        : {};
    const source: Record<string, unknown> = { ...record, ...proposed };
    for (const field of fields) initial[field.id] = initialFieldValue(field, source);
    setValues(initial);
    setOwner(record._owner?.id ?? '');
    setLifecycle(record._lifecycle?.id ?? '');
    setError('');
    setNote('');
  }, [open, record, relationSchemas, revisable, latestRevision]);

  const collectData = (record: Record<string, unknown>) => {
    const data: Record<string, unknown> = {};
    for (const field of activeFields) {
      const raw =
        values[field.id] ??
        (field.type === 'entityRelation' || isMultiValuedRelationSelectField(field) ? [] : '');
      if (!fieldValueChanged(field, raw, record)) continue;
      data[field.id] = toFieldValue(field, raw);
    }
    return data;
  };

  const handleSave = async (mode: 'direct' | 'submit' | 'bypass') => {
    if (!record) return;
    setError('');
    const data = collectData(record);
    // Approval proposals only carry field data; owner/lifecycle are applied directly.
    if (mode === 'direct') {
      if (record.canAdmin && owner !== (record._owner?.id ?? '')) {
        data['_owner'] = owner === '' ? null : owner;
      }
      if (record.canEdit && lifecycle !== (record._lifecycle?.id ?? '')) {
        data['_lifecycle'] = lifecycle === '' ? null : lifecycle;
      }
    }
    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }
    try {
      if (mode === 'direct') {
        await updateMutation.mutateAsync({ relationId: record._uid, data });
      } else {
        const body = {
          baseVersion: record._version ?? 1,
          proposedState: { data }
        };
        if (mode === 'bypass') {
          await bypassMutation.mutateAsync({ ...body, reason: note.trim() });
        } else if (openApproval && revisable) {
          await resubmitMutation.mutateAsync({
            ...body,
            approvalId: openApproval.id,
            message: note.trim() || undefined
          });
        } else {
          await submitMutation.mutateAsync({ ...body, message: note.trim() || undefined });
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save relation');
      return;
    }
    onClose();
  };

  const isSaving =
    updateMutation.isPending ||
    submitMutation.isPending ||
    resubmitMutation.isPending ||
    bypassMutation.isPending;
  const canBypass = approvalRequired && canOverrideEntityApproval && (!openApproval || revisable);
  const buttons = [
    { label: 'Cancel', type: 'secondary' as const, onClick: onClose },
    ...(canBypass
      ? [
          {
            label: 'Bypass approval',
            type: 'danger' as const,
            onClick: () => handleSave('bypass'),
            disabled: !record || isSaving || note.trim() === ''
          }
        ]
      : []),
    approvalRequired
      ? {
          label: revisable ? 'Resubmit for approval' : 'Request approval',
          type: 'default' as const,
          onClick: () => handleSave('submit'),
          disabled: !record || isSaving || proposalBlocksEdit
        }
      : {
          label: 'Save',
          type: 'default' as const,
          onClick: () => handleSave('direct'),
          disabled: !record || isSaving
        }
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit relation"
      sub={relationSchema?.name}
      width="min(480px, calc(100vw - 48px))"
      buttons={buttons}
    >
      {!record ? (
        <LoadingState text="Loading relation..." size="sm" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {proposalBlocksEdit && (
            <Banner variant="info">
              A change proposal is already pending for this relation. Withdraw it or wait for a
              decision before proposing another change.
            </Banner>
          )}
          {approvalRequired && (
            <Banner variant="info">
              This relation type requires approval. Field changes are submitted as a proposal; owner
              and lifecycle cannot be changed here.
            </Banner>
          )}
          <FormElement label="Owner">
            <Select.Root
              value={owner || undefined}
              disabled={!record.canAdmin || approvalRequired}
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
              disabled={!record.canEdit || approvalRequired}
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
            <RelationFieldsForm
              workspaceId={workspaceId}
              fields={activeFields}
              groups={relationSchema?.groups}
              values={values}
              onChange={(fieldId, value) => setValues(v => ({ ...v, [fieldId]: value }))}
            />
          )}
          {approvalRequired && (
            <FormElement label={canBypass ? 'Note / bypass reason' : 'Note'}>
              <TextInput
                value={note}
                onChange={value => setNote(value ?? '')}
                style={{ width: '100%' }}
              />
            </FormElement>
          )}
          {error && <Banner variant="error">{error}</Banner>}
        </div>
      )}
    </Dialog>
  );
};
