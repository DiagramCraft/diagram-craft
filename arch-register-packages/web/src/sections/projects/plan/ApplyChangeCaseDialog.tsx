import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useEntity } from '../../../hooks/useEntities';
import { useRelation } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import {
  useChangeCase,
  useChangeCaseApplyConflicts,
  useApplyChangeCase
} from '../../../hooks/useChangeCases';
import {
  findRelationSnapshotConflicts,
  findSnapshotConflicts,
  resolveSnapshotEntityData,
  resolveSnapshotRelationData,
  type SnapshotConflict
} from './projectSnapshotState';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { ChangeCaseMember } from '@arch-register/api-types/changeCaseContract';
import { LoadingState } from '../../../components/LoadingState';
import styles from './ApplyChangeCaseDialog.module.css';

type Props = {
  open: boolean;
  workspaceId: string;
  projectId: string;
  caseId: string;
  schemas: EntitySchema[];
  onClose: () => void;
};

type MemberStepProps = {
  workspaceId: string;
  member: ChangeCaseMember;
  schemas: EntitySchema[];
  stale: boolean;
  onResolved: (memberId: string, resolvedEntityData: Record<string, unknown>) => void;
};

const formatVal = (v: unknown) => {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
};

const relationLabel = (relation: { _in: { name: string }; _out: { name: string } }) =>
  `${relation._in.name} → ${relation._out.name}`;

const MemberName = ({ workspaceId, member }: { workspaceId: string; member: ChangeCaseMember }) => {
  const { data: relation } = useRelation(
    workspaceId,
    member.kind === 'relation' ? member.entity_id : ''
  );
  if (member.kind === 'relation') {
    return <span>{relation ? relationLabel(relation) : member.entity_id}</span>;
  }
  return (
    <span>
      {(member.proposed_state['name'] as string | undefined) ??
        (member.base_state['name'] as string | undefined) ??
        member.entity_id}
    </span>
  );
};

type ConflictListProps = {
  memberId: string;
  name: string;
  conflicts: SnapshotConflict[];
  choices: Record<string, 'proposed' | 'current'>;
  setChoices: (
    updater: (
      prev: Record<string, 'proposed' | 'current'>
    ) => Record<string, 'proposed' | 'current'>
  ) => void;
};

const ConflictList = ({ memberId, name, conflicts, choices, setChoices }: ConflictListProps) => {
  if (conflicts.length === 0) {
    return (
      <p style={{ margin: 0 }}>
        <strong>{name}</strong> — no conflicts. The planned changes will be applied as-is.
      </p>
    );
  }
  return (
    <>
      <p style={{ margin: '0 0 12px 0' }}>
        <strong>{name}</strong> changed since this case was planned. Choose which value to keep for
        each conflicting field.
      </p>
      <div className={styles.conflictList}>
        {conflicts.map(c => (
          <div key={c.key} className={styles.conflictRow}>
            <div className={styles.conflictLabel}>{c.label}</div>
            <label className={styles.conflictOption}>
              <input
                type="radio"
                name={`conflict-${memberId}-${c.key}`}
                checked={(choices[c.key] ?? 'proposed') === 'proposed'}
                onChange={() => setChoices(prev => ({ ...prev, [c.key]: 'proposed' }))}
              />
              <span className={styles.conflictOptionLabel}>
                Planned: {formatVal(c.proposedVal)}
              </span>
            </label>
            <label className={styles.conflictOption}>
              <input
                type="radio"
                name={`conflict-${memberId}-${c.key}`}
                checked={choices[c.key] === 'current'}
                onChange={() => setChoices(prev => ({ ...prev, [c.key]: 'current' }))}
              />
              <span className={styles.conflictOptionLabel}>Current: {formatVal(c.currentVal)}</span>
            </label>
          </div>
        ))}
      </div>
    </>
  );
};

const EntityMemberStep = ({ workspaceId, member, schemas, stale, onResolved }: MemberStepProps) => {
  const { data: entity } = useEntity(workspaceId, member.entity_id);
  const schema = entity ? (schemas.find(s => s.id === entity._schema.id) ?? null) : null;
  const [conflictChoices, setConflictChoices] = useState<Record<string, 'proposed' | 'current'>>(
    {}
  );

  const proposed = member.proposed_state;
  const base = member.base_state;
  const conflicts = stale ? findSnapshotConflicts(entity, schema, proposed, base) : [];

  // biome-ignore lint/correctness/useExhaustiveDependencies: onResolved is a fresh callback each render; including it would create a render loop
  useEffect(() => {
    if (!entity) return;
    const resolved = resolveSnapshotEntityData({ entity, schema, proposed, base, conflictChoices });
    onResolved(member.id, resolved);
  }, [entity, schema, conflictChoices, member.id]);

  if (!entity) return <LoadingState text="Loading entity..." size="sm" />;

  return (
    <ConflictList
      memberId={member.id}
      name={entity._name}
      conflicts={conflicts}
      choices={conflictChoices}
      setChoices={setConflictChoices}
    />
  );
};

const RelationMemberStep = ({ workspaceId, member, stale, onResolved }: MemberStepProps) => {
  const { data: relation, isError } = useRelation(workspaceId, member.entity_id);
  const { data: relationSchemas } = useRelationSchemas(workspaceId);
  const schemaId = relation?._schema.id ?? (member.base_state['schema_id'] as string | undefined);
  const schema = relationSchemas?.find(s => s.id === schemaId) ?? null;
  const [conflictChoices, setConflictChoices] = useState<Record<string, 'proposed' | 'current'>>(
    {}
  );

  const proposed = member.proposed_state;
  const base = member.base_state;
  const conflicts = stale ? findRelationSnapshotConflicts(relation, schema, proposed, base) : [];

  // biome-ignore lint/correctness/useExhaustiveDependencies: onResolved is a fresh callback each render; including it would create a render loop
  useEffect(() => {
    if (!relation || !relationSchemas) return;
    const resolved = resolveSnapshotRelationData({
      relation,
      schema,
      proposed,
      base,
      conflictChoices
    });
    onResolved(member.id, resolved);
  }, [relation, relationSchemas, schema, conflictChoices, member.id]);

  if (isError) return <p style={{ margin: 0 }}>This relation could not be loaded.</p>;
  if (!relation || !relationSchemas) return <LoadingState text="Loading relation..." size="sm" />;

  return (
    <ConflictList
      memberId={member.id}
      name={relationLabel(relation)}
      conflicts={conflicts}
      choices={conflictChoices}
      setChoices={setConflictChoices}
    />
  );
};

const MemberStep = (props: MemberStepProps) =>
  props.member.kind === 'relation' ? (
    <RelationMemberStep {...props} />
  ) : (
    <EntityMemberStep {...props} />
  );

export const ApplyChangeCaseDialog = ({
  open,
  workspaceId,
  projectId,
  caseId,
  schemas,
  onClose
}: Props) => {
  const { data: changeCase } = useChangeCase(workspaceId, projectId, caseId, open);
  const { data: conflicts = [] } = useChangeCaseApplyConflicts(
    workspaceId,
    projectId,
    caseId,
    open
  );
  const applyMutation = useApplyChangeCase(workspaceId, projectId);

  const [stepIndex, setStepIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setResolutions({});
  }, [open]);

  const members = changeCase?.members ?? [];
  const staleByMemberId = new Set(conflicts.filter(c => c.stale).map(c => c.memberId));

  if (!open) return null;

  if (!changeCase || members.length === 0) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Apply planned change"
        buttons={[{ label: 'Cancel', type: 'cancel', onClick: onClose }]}
      >
        <LoadingState text="Loading..." size="sm" />
      </Dialog>
    );
  }

  const currentMember = members[stepIndex]!;
  const isLastStep = stepIndex === members.length - 1;
  const allResolved = members.every(m => resolutions[m.id] !== undefined);

  const handleApply = () => {
    applyMutation.mutate(
      {
        caseId,
        resolutions: members.map(m => ({
          memberId: m.id,
          resolvedEntityData: resolutions[m.id]!
        }))
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Apply planned change (${stepIndex + 1} of ${members.length})`}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        ...(stepIndex > 0
          ? [{ label: 'Back', type: 'cancel' as const, onClick: () => setStepIndex(i => i - 1) }]
          : []),
        isLastStep
          ? {
              label: applyMutation.isPending ? 'Applying...' : 'Apply all',
              type: 'default' as const,
              disabled: applyMutation.isPending || !allResolved,
              onClick: handleApply
            }
          : {
              label: 'Next',
              type: 'default' as const,
              disabled: resolutions[currentMember.id] === undefined,
              onClick: () => setStepIndex(i => i + 1)
            }
      ]}
    >
      {(changeCase.name || changeCase.commit_message) && (
        <div className={styles.caseSummaryHead}>
          {changeCase.name && <div className={styles.caseSummaryName}>{changeCase.name}</div>}
          {changeCase.commit_message && (
            <div className={styles.caseSummaryDescription}>{changeCase.commit_message}</div>
          )}
        </div>
      )}

      {members.length > 1 && (
        <div className={styles.memberSummaryList}>
          {members.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.memberSummaryItem} ${i === stepIndex ? styles.memberSummaryItemActive : ''} ${resolutions[m.id] !== undefined ? styles.memberSummaryItemDone : ''}`}
              onClick={() => setStepIndex(i)}
            >
              <MemberName workspaceId={workspaceId} member={m} />
              {staleByMemberId.has(m.id) && (
                <span className={styles.memberSummaryStale}>needs review</span>
              )}
            </button>
          ))}
        </div>
      )}

      <MemberStep
        key={currentMember.id}
        workspaceId={workspaceId}
        member={currentMember}
        schemas={schemas}
        stale={staleByMemberId.has(currentMember.id)}
        onResolved={(memberId, resolvedEntityData) =>
          setResolutions(prev => ({ ...prev, [memberId]: resolvedEntityData }))
        }
      />
    </Dialog>
  );
};
