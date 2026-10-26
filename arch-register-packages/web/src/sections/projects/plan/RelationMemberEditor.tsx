import { useEffect, useState } from 'react';
import { useRelation } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { RelationFieldsForm, emptyRelationFieldValue } from '../../../dialogs/RelationFieldsForm';
import {
  activeFieldsOf,
  fieldValueChanged,
  initialFieldValue,
  toFieldValue
} from '../../../dialogs/RelationEditDialog';
import { LoadingState } from '../../../components/LoadingState';
import styles from './plan-change-dialog-shared.module.css';

type Props = {
  workspaceId: string;
  memberKey: string;
  relationId: string;
  isActive: boolean;
  existingProposedState?: Record<string, unknown> | null;
  onProposedStateChange: (memberKey: string, proposedState: Record<string, unknown>) => void;
  onChangedLabelsChange: (memberKey: string, labels: string[]) => void;
};

// Edits the planned field values of one relation member of a change case. Relation endpoints and
// schema are immutable and owner/lifecycle are not part of a relation proposal, so only field data
// is editable. The proposed state carries the full data object (visible base values plus edits),
// matching how the apply step writes it back.
export const RelationMemberEditor = ({
  workspaceId,
  memberKey,
  relationId,
  isActive,
  existingProposedState,
  onProposedStateChange,
  onChangedLabelsChange
}: Props) => {
  const { data: record } = useRelation(workspaceId, relationId);
  const { data: relationSchemas } = useRelationSchemas(workspaceId);
  const schema = relationSchemas?.find(s => s.id === record?._schema.id);
  const fields = activeFieldsOf(schema);
  const [values, setValues] = useState<Record<string, string | string[]> | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: existingProposedState is only read once, on initial load
  useEffect(() => {
    if (!record || !schema || values !== null) return;
    const proposed = (existingProposedState?.['data'] as Record<string, unknown> | undefined) ?? {};
    const source: Record<string, unknown> = { ...record, ...proposed };
    const initial: Record<string, string | string[]> = {};
    for (const field of fields) initial[field.id] = initialFieldValue(field, source);
    setValues(initial);
  }, [record, schema, values]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: callbacks are fresh each render; including them would create a render loop
  useEffect(() => {
    if (!record || !schema || !values) return;
    const data: Record<string, unknown> = {};
    const labels: string[] = [];
    for (const field of fields) {
      const raw = values[field.id] ?? emptyRelationFieldValue(field);
      const next = toFieldValue(field, raw);
      if (fieldValueChanged(field, raw, record)) {
        labels.push(field.name);
        data[field.id] = next;
      } else if (record[field.id] !== undefined) {
        data[field.id] = record[field.id];
      }
    }
    onProposedStateChange(memberKey, { data });
    onChangedLabelsChange(memberKey, labels);
  }, [record, schema, values, memberKey]);

  return (
    <div style={{ display: isActive ? undefined : 'none' }}>
      {!record || !schema || !values ? (
        <LoadingState text="Loading..." size="sm" />
      ) : (
        <div className={styles.editorPaneContent}>
          {fields.length === 0 ? (
            <div className="dim">This relation type has no editable fields.</div>
          ) : (
            <RelationFieldsForm
              workspaceId={workspaceId}
              fields={fields}
              groups={schema.groups}
              values={values}
              disabled={!record.canEdit}
              onChange={(fieldId, value) => setValues(v => ({ ...(v ?? {}), [fieldId]: value }))}
            />
          )}
        </div>
      )}
    </div>
  );
};
