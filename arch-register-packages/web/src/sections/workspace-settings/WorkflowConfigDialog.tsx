import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { MemberAvatar, stableHue } from '../../components/MemberAvatar';
import { UserGroupPicker } from '../../components/UserGroupPicker';
import { useWorkspaceUsers } from '../../hooks/useWorkspaceMembers';
import { useTeams } from '../../hooks/useWorkspaceConfig';
import type {
  DocumentField,
  DocumentStatusApproval
} from '@arch-register/api-types/documentContract';
import styles from './WorkflowConfigDialog.module.css';

type EnumOption = NonNullable<DocumentField['enumOptions']>[number];

type WorkflowConfigDialogProps = {
  open: boolean;
  workspaceSlug: string;
  field: DocumentField;
  allFields: DocumentField[];
  onClose: () => void;
  onSave: (patch: Pick<DocumentField, 'isStatus' | 'enumOptions'>) => void;
};

const FALLBACK = '__fallback__';

const defaultApproval = (): DocumentStatusApproval => ({
  required: true,
  requiredApprovals: 1,
  fallbackUserIds: [],
  fallbackTeamIds: []
});

const copyOptions = (options: DocumentField['enumOptions']): EnumOption[] =>
  (options ?? []).map(option => ({
    ...option,
    ...(option.approval
      ? {
          approval: {
            required: option.approval.required,
            requiredApprovals: option.approval.requiredApprovals ?? 1,
            approverFieldId: option.approval.approverFieldId,
            fallbackUserIds: [...(option.approval.fallbackUserIds ?? [])],
            fallbackTeamIds: [...(option.approval.fallbackTeamIds ?? [])]
          }
        }
      : {})
  }));

const PickedUsers = ({
  ids,
  users,
  onRemove
}: {
  ids: string[];
  users: Array<{ id: string; display_name: string; email: string | null; color?: string | null }>;
  onRemove: (id: string) => void;
}) => {
  const byId = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);
  if (ids.length === 0) return null;
  return (
    <div className={styles.pickedList}>
      {ids.map(id => {
        const user = byId.get(id);
        return (
          <span key={id} className={styles.pickedChip}>
            <MemberAvatar
              name={user?.display_name ?? null}
              email={user?.email ?? null}
              userId={id}
              color={user?.color ?? null}
              size={16}
              hideTooltip
            />
            {user?.display_name ?? 'Unavailable user'}
            <button
              type="button"
              className={styles.pickedRemove}
              title="Remove approver"
              onClick={() => onRemove(id)}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
};

const PickedTeams = ({
  ids,
  labels,
  onRemove
}: {
  ids: string[];
  labels: Map<string, string>;
  onRemove: (id: string) => void;
}) => {
  if (ids.length === 0) return null;
  return (
    <div className={styles.pickedList}>
      {ids.map(id => (
        <span key={id} className={styles.pickedChip}>
          <span
            className={styles.teamDot}
            style={{ background: `oklch(0.65 0.15 ${stableHue(id)})` }}
          />
          {labels.get(id) ?? 'Unavailable team'}
          <button
            type="button"
            className={styles.pickedRemove}
            title="Remove approver"
            onClick={() => onRemove(id)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
};

export const WorkflowConfigDialog = ({
  open,
  workspaceSlug,
  field,
  allFields,
  onClose,
  onSave
}: WorkflowConfigDialogProps) => {
  const { data: users = [] } = useWorkspaceUsers(workspaceSlug, open);
  const { data: teams = [] } = useTeams(workspaceSlug, open);
  const [enabled, setEnabled] = useState(false);
  const [options, setOptions] = useState<EnumOption[]>([]);

  const sourceFields = useMemo(
    () =>
      allFields.filter(
        candidate =>
          candidate.id !== field.id &&
          (candidate.type === 'user_link' || candidate.type === 'team_link')
      ),
    [allFields, field.id]
  );
  const activeUsers = users.filter(user => user.is_active);
  const teamLabels = useMemo(() => new Map(teams.map(team => [team.id, team.name])), [teams]);

  useEffect(() => {
    if (!open) return;
    setEnabled(field.isStatus === true);
    setOptions(copyOptions(field.enumOptions));
  }, [field, open]);

  const updateOption = (value: string, update: (option: EnumOption) => EnumOption) => {
    setOptions(current =>
      current.map(option => (option.value === value ? update(option) : option))
    );
  };

  const updateApproval = (
    option: EnumOption,
    update: Partial<DocumentStatusApproval>
  ): EnumOption => ({
    ...option,
    approval: { ...defaultApproval(), ...(option.approval ?? {}), ...update }
  });

  const toggleApproval = (option: EnumOption, required: boolean) => {
    updateOption(option.value, current =>
      required ? updateApproval(current, { required: true }) : { ...current, approval: undefined }
    );
  };

  const addApprover = (option: EnumOption, kind: 'user' | 'team', id: string) => {
    updateOption(option.value, current => {
      const approval = { ...defaultApproval(), ...(current.approval ?? {}) };
      const key = kind === 'user' ? 'fallbackUserIds' : 'fallbackTeamIds';
      const values = approval[key];
      return updateApproval(current, { [key]: values.includes(id) ? values : [...values, id] });
    });
  };

  const removeApprover = (option: EnumOption, kind: 'user' | 'team', id: string) => {
    updateOption(option.value, current => {
      const approval = { ...defaultApproval(), ...(current.approval ?? {}) };
      const key = kind === 'user' ? 'fallbackUserIds' : 'fallbackTeamIds';
      return updateApproval(current, { [key]: approval[key].filter(value => value !== id) });
    });
  };

  const save = () => {
    const enumOptions = options.map(option => {
      if (!enabled || !option.approval?.required) return { ...option, approval: undefined };
      const approval = { ...defaultApproval(), ...option.approval };
      return {
        ...option,
        approval: {
          required: true,
          requiredApprovals: Math.max(1, approval.requiredApprovals ?? 1),
          approverFieldId: approval.approverFieldId,
          fallbackUserIds: approval.fallbackUserIds,
          fallbackTeamIds: approval.fallbackTeamIds
        }
      };
    });
    onSave({ isStatus: enabled, enumOptions });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Configure workflow · ${field.name}`}
      width={720}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        { label: 'Save workflow', type: 'default', onClick: save }
      ]}
    >
      <div className={styles.body}>
        <div className={styles.intro}>
          <label className={styles.check}>
            <Checkbox value={enabled} onChange={value => setEnabled(value ?? false)} />
            Use this enum as a document status workflow
          </label>
          <p className={styles.hint}>
            Documents can save immediately while a status transition waits for the configured
            approvers. The current status remains effective until approval completes.
          </p>
        </div>

        <div className={styles.optionList}>
          {options.map(option => {
            const approval = option.approval;
            const source = sourceFields.find(item => item.id === approval?.approverFieldId);
            return (
              <div key={option.value} className={styles.optionCard}>
                <div className={styles.optionHead}>
                  <div>
                    <div className={styles.optionName}>{option.label}</div>
                    <div className={styles.optionValue}>Value: {option.value}</div>
                  </div>
                  <label className={styles.check}>
                    <Checkbox
                      value={approval?.required ?? false}
                      disabled={!enabled}
                      onChange={value => toggleApproval(option, value ?? false)}
                    />
                    Approval required
                  </label>
                </div>

                {enabled && approval?.required && (
                  <div className={styles.optionBody}>
                    <div className={styles.field}>
                      <div className={styles.fieldLeft}>
                        <div className={styles.fieldLabel}>Required approvals</div>
                        <div className={styles.fieldHint}>
                          Number of approvals needed before the status change is applied.
                        </div>
                      </div>
                      <div className={styles.fieldRight}>
                        <TextInput
                          type="number"
                          value={String(approval.requiredApprovals ?? 1)}
                          onChange={value =>
                            updateOption(option.value, current =>
                              updateApproval(current, {
                                requiredApprovals: Math.max(1, Number(value ?? 1) || 1)
                              })
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.fieldLeft}>
                        <div className={styles.fieldLabel}>Approver source</div>
                        <div className={styles.fieldHint}>
                          Read approvers from a document field, or use the fallback list below.
                        </div>
                      </div>
                      <div className={styles.fieldRight}>
                        <Select.Root
                          value={approval.approverFieldId ?? FALLBACK}
                          onChange={value =>
                            updateOption(option.value, current =>
                              updateApproval(current, {
                                approverFieldId:
                                  value === FALLBACK ? undefined : (value ?? undefined)
                              })
                            )
                          }
                        >
                          <Select.Item value={FALLBACK}>Fallback users and teams only</Select.Item>
                          {sourceFields.map(sourceField => (
                            <Select.Item key={sourceField.id} value={sourceField.id}>
                              Document field: {sourceField.name} (
                              {sourceField.type === 'user_link' ? 'users' : 'teams/groups'})
                            </Select.Item>
                          ))}
                        </Select.Root>
                        {source && (
                          <p className={styles.sourceInfo}>
                            Approvers will be read from the document's{' '}
                            <strong>{source.name}</strong>{' '}
                            {source.type === 'user_link' ? 'user values.' : 'team/group values.'}{' '}
                            The fallback list below is used whenever that field has no value.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.fieldLeft}>
                        <div className={styles.fieldLabel}>Fallback users</div>
                        <div className={styles.fieldHint}>
                          {source
                            ? 'Used when the document field above has no value.'
                            : 'Used as the approvers for this status.'}
                        </div>
                      </div>
                      <div className={styles.fieldRight}>
                        <PickedUsers
                          ids={approval.fallbackUserIds ?? []}
                          users={activeUsers}
                          onRemove={id => removeApprover(option, 'user', id)}
                        />
                        <UserGroupPicker
                          items={activeUsers.map(user => ({
                            id: user.id,
                            kind: 'user' as const,
                            label: user.display_name,
                            email: user.email,
                            color: user.color
                          }))}
                          excludeIds={approval.fallbackUserIds}
                          onSelect={item => addApprover(option, 'user', item.id)}
                          placeholder="Search users to add…"
                        />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.fieldLeft}>
                        <div className={styles.fieldLabel}>Fallback teams / groups</div>
                        <div className={styles.fieldHint}>
                          {source
                            ? 'Used when the document field above has no value.'
                            : 'Used as the approvers for this status.'}
                        </div>
                      </div>
                      <div className={styles.fieldRight}>
                        <PickedTeams
                          ids={approval.fallbackTeamIds ?? []}
                          labels={teamLabels}
                          onRemove={id => removeApprover(option, 'team', id)}
                        />
                        <UserGroupPicker
                          items={teams.map(team => ({
                            id: team.id,
                            kind: 'team' as const,
                            label: team.name
                          }))}
                          excludeIds={approval.fallbackTeamIds}
                          onSelect={item => addApprover(option, 'team', item.id)}
                          placeholder="Search teams or groups to add…"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
};
