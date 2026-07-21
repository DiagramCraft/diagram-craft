import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceUsers } from '../../hooks/useWorkspaceMembers';
import { useTeams } from '../../hooks/useWorkspaceConfig';
import type {
  DocumentField,
  DocumentStatusApproval
} from '@arch-register/api-types/documentContract';

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
const ADD_USER = '__add_user__';
const ADD_TEAM = '__add_team__';

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

const PickerValues = ({
  values,
  labels,
  onRemove
}: {
  values: string[];
  labels: Map<string, string>;
  onRemove: (value: string) => void;
}) => (
  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
    {values.map(value => (
      <button
        type="button"
        key={value}
        onClick={() => onRemove(value)}
        title="Remove approver"
        style={{
          border: '1px solid var(--cmp-border)',
          borderRadius: 999,
          background: 'var(--cmp-bg)',
          color: 'var(--base-fg)',
          padding: '3px 8px',
          cursor: 'pointer'
        }}
      >
        {labels.get(value) ?? 'Unavailable approver'} ×
      </button>
    ))}
  </span>
);

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
  const userLabels = useMemo(
    () => new Map(users.map(user => [user.id, user.display_name])),
    [users]
  );
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

  const addApprover = (option: EnumOption, kind: 'user' | 'team', id: string | null) => {
    if (!id || id === ADD_USER || id === ADD_TEAM) return;
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
      <div style={{ display: 'grid', gap: 18, maxHeight: '70vh', overflowY: 'auto' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={event => setEnabled(event.target.checked)}
          />
          Use this enum as a document status workflow
        </label>
        <p className="dim" style={{ margin: 0, fontSize: 12 }}>
          Documents can save immediately while a status transition waits for the configured
          approvers. The current status remains effective until approval completes.
        </p>

        {options.map(option => {
          const approval = option.approval;
          const source = sourceFields.find(item => item.id === approval?.approverFieldId);
          return (
            <section
              key={option.value}
              style={{
                display: 'grid',
                gap: 10,
                borderTop: '1px solid var(--cmp-border)',
                paddingTop: 14
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong>{option.label}</strong>
                  <div className="dim" style={{ fontSize: 11 }}>
                    Value: {option.value}
                  </div>
                </div>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={approval?.required ?? false}
                    disabled={!enabled}
                    onChange={event => toggleApproval(option, event.target.checked)}
                  />
                  Approval required
                </label>
              </div>

              {enabled && approval?.required && (
                <>
                  <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>
                    Required approvals
                    <TextInput
                      value={String(approval.requiredApprovals ?? 1)}
                      onChange={value =>
                        updateOption(option.value, current =>
                          updateApproval(current, {
                            requiredApprovals: Math.max(1, Number(value ?? 1) || 1)
                          })
                        )
                      }
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>
                    Approver source
                    <Select.Root
                      value={approval.approverFieldId ?? FALLBACK}
                      onChange={value =>
                        updateOption(option.value, current =>
                          updateApproval(current, {
                            approverFieldId: value === FALLBACK ? undefined : (value ?? undefined)
                          })
                        )
                      }
                    >
                      <Select.Item value={FALLBACK}>Fallback users and teams</Select.Item>
                      {sourceFields.map(sourceField => (
                        <Select.Item key={sourceField.id} value={sourceField.id}>
                          Document field: {sourceField.name} (
                          {sourceField.type === 'user_link' ? 'users' : 'teams/groups'})
                        </Select.Item>
                      ))}
                    </Select.Root>
                  </label>

                  {source ? (
                    <p className="dim" style={{ margin: 0, fontSize: 12 }}>
                      Approvers will be read from the document’s <strong>{source.name}</strong>{' '}
                      {source.type === 'user_link' ? 'user values.' : 'team/group values.'}
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>
                        Fallback users
                        <Select.Root
                          value={ADD_USER}
                          onChange={value => addApprover(option, 'user', value ?? null)}
                        >
                          <Select.Item value={ADD_USER}>Add a user…</Select.Item>
                          {activeUsers.map(user => (
                            <Select.Item key={user.id} value={user.id}>
                              {user.display_name} {user.email ? `(${user.email})` : ''}
                            </Select.Item>
                          ))}
                        </Select.Root>
                        <PickerValues
                          values={approval.fallbackUserIds ?? []}
                          labels={userLabels}
                          onRemove={id => removeApprover(option, 'user', id)}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 5, fontSize: 12 }}>
                        Fallback teams / groups
                        <Select.Root
                          value={ADD_TEAM}
                          onChange={value => addApprover(option, 'team', value ?? null)}
                        >
                          <Select.Item value={ADD_TEAM}>Add a team or group…</Select.Item>
                          {teams.map(team => (
                            <Select.Item key={team.id} value={team.id}>
                              {team.name}
                            </Select.Item>
                          ))}
                        </Select.Root>
                        <PickerValues
                          values={approval.fallbackTeamIds ?? []}
                          labels={teamLabels}
                          onRemove={id => removeApprover(option, 'team', id)}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>
    </Dialog>
  );
};
