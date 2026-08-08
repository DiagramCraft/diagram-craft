import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Table } from '../../../components/table/Table';
import { Chip } from '../../../components/Chip';
import { UserGroupPicker } from '../../../components/UserGroupPicker';
import type {
  GovernanceWorkflowConfigRow,
  GovernanceWorkflowConfigUpsert
} from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceWorkflowCaseKind } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import { useDocumentTypes } from '../../../hooks/useDocuments';
import { useSchemas } from '../../../hooks/useSchemas';
import { useWorkspaceMembers } from '../../../hooks/useWorkspaceMembers';
import { useTeams } from '../../../hooks/useWorkspaceConfig';
import {
  useGovernanceWorkflowConfig,
  useResetGovernanceWorkflowConfig,
  useUpsertGovernanceWorkflowConfig
} from '../../../hooks/useGovernanceWorkflowConfig';
import styles from './WorkflowsSubSection.module.css';

const documentStatusExtension = (config: GovernanceWorkflowConfig) => {
  const extension = config.extensions['document.status'];
  if (!extension || typeof extension !== 'object') return { statusesRequiringApprovals: [] };
  const values = (extension as { statusesRequiringApprovals?: unknown }).statusesRequiringApprovals;
  return {
    statusesRequiringApprovals: Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string')
      : []
  };
};

const defaultConfig = (caseKind: GovernanceWorkflowCaseKind): GovernanceWorkflowConfig =>
  caseKind.defaultConfig;

const parseDays = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item >= 0);

const FallbackTargetPicker = ({
  workspaceSlug,
  kind,
  values,
  onChange,
  maxValues
}: {
  workspaceSlug: string;
  kind: 'user' | 'team';
  values: string[];
  onChange: (values: string[]) => void;
  maxValues?: number;
}) => {
  const { data: members = [] } = useWorkspaceMembers(workspaceSlug);
  const { data: teams = [] } = useTeams(workspaceSlug);
  const labels = useMemo(
    () =>
      new Map(
        kind === 'user'
          ? members.map(member => [member.user_id, member.display_name])
          : teams.map(team => [team.id, team.name])
      ),
    [kind, members, teams]
  );

  return (
    <div className={styles.fallbackPicker}>
      <UserGroupPicker
        kind={kind}
        activeOnly={kind === 'user'}
        excludeIds={values}
        onSelect={item =>
          maxValues !== undefined && values.length >= maxValues
            ? undefined
            : onChange([...values, item.id])
        }
        placeholder={kind === 'user' ? 'Search users to add…' : 'Search teams to add…'}
      />
      {values.length > 0 && (
        <div className={styles.selectedValues}>
          {values.map(id => (
            <Chip key={id}>
              <span>{labels.get(id) ?? id}</span>
              <button
                type="button"
                className={styles.removeValue}
                aria-label={`Remove ${labels.get(id) ?? id}`}
                onClick={() => onChange(values.filter(value => value !== id))}
              >
                <TbX size={10} />
              </button>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
};

const DocumentStatusSubkindEditor = ({
  workspaceSlug,
  value,
  onChange
}: {
  workspaceSlug: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) => {
  const { data: documentTypes = [] } = useDocumentTypes(workspaceSlug);
  const [documentTypeId, fieldId] = value?.split(':') ?? [];
  const documentType = documentTypes.find(type => type.id === documentTypeId);
  const enumFields =
    documentType?.fields.filter(field => field.type === 'enum' && !field.retired) ?? [];

  return (
    <div className={styles.subkindFields}>
      <FormElement label="Document type">
        <Select.Root
          value={documentTypeId ?? undefined}
          onChange={next => onChange(next ? `${next}:` : null)}
          placeholder="Select document type"
        >
          {documentTypes.map(type => (
            <Select.Item key={type.id} value={type.id}>
              {type.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      <FormElement label="Status field">
        <Select.Root
          value={fieldId && enumFields.some(field => field.id === fieldId) ? fieldId : undefined}
          onChange={next => onChange(documentTypeId && next ? `${documentTypeId}:${next}` : value)}
          placeholder="Select enum field"
          disabled={!documentTypeId}
        >
          {enumFields.map(field => (
            <Select.Item key={field.id} value={field.id}>
              {field.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
    </div>
  );
};

const EntitySchemaSubkindEditor = ({
  workspaceSlug,
  value,
  onChange
}: {
  workspaceSlug: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) => {
  const { data: schemas = [] } = useSchemas(workspaceSlug);

  return (
    <FormElement label="Entity schema">
      <Select.Root
        value={value ?? undefined}
        onChange={next => onChange(next ?? null)}
        placeholder="Select entity schema"
      >
        {schemas.map(schema => (
          <Select.Item key={schema.id} value={schema.id}>
            {schema.name}
          </Select.Item>
        ))}
      </Select.Root>
    </FormElement>
  );
};

const FieldDateReminderSubkindEditor = ({
  workspaceSlug,
  value,
  onChange
}: {
  workspaceSlug: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) => {
  const { data: schemas = [] } = useSchemas(workspaceSlug);
  const [schemaId, fieldId] = value?.split(':') ?? [];
  const schema = schemas.find(item => item.id === schemaId);
  const dateFields = schema?.fields.filter(field => field.type === 'date' && !field.archived) ?? [];

  return (
    <div className={styles.subkindFields}>
      <FormElement label="Entity schema">
        <Select.Root
          value={schemaId ?? undefined}
          onChange={next => onChange(next ? `${next}:` : null)}
          placeholder="Select entity schema"
        >
          {schemas.map(item => (
            <Select.Item key={item.id} value={item.id}>
              {item.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      <FormElement label="Date field">
        <Select.Root
          value={fieldId && dateFields.some(field => field.id === fieldId) ? fieldId : undefined}
          onChange={next => onChange(schemaId && next ? `${schemaId}:${next}` : value)}
          placeholder="Select date field"
          disabled={!schemaId}
        >
          {dateFields.map(field => (
            <Select.Item key={field.id} value={field.id}>
              {field.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
    </div>
  );
};

const SubkindEditor = ({
  workspaceSlug,
  caseKind,
  value,
  onChange
}: {
  workspaceSlug: string;
  caseKind: GovernanceWorkflowCaseKind;
  value: string | null;
  onChange: (value: string | null) => void;
}) => {
  if (caseKind.case_kind === 'document.status') {
    return (
      <DocumentStatusSubkindEditor
        workspaceSlug={workspaceSlug}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (
    caseKind.case_kind === 'entity.change-case' ||
    caseKind.case_kind === 'entity.change-case.bulk' ||
    caseKind.case_kind === 'entity.deprecation'
  ) {
    return (
      <EntitySchemaSubkindEditor workspaceSlug={workspaceSlug} value={value} onChange={onChange} />
    );
  }
  if (caseKind.case_kind === 'field-date-reminder') {
    return (
      <FieldDateReminderSubkindEditor
        workspaceSlug={workspaceSlug}
        value={value}
        onChange={onChange}
      />
    );
  }
  return <div className={styles.emptyNote}>This workflow does not define a scope selector.</div>;
};

type StrategySection =
  | NonNullable<GovernanceWorkflowConfig['approvals']>
  | NonNullable<GovernanceWorkflowConfig['escalation']>;

const StrategyEditor = ({
  label,
  strategies,
  section,
  fields,
  onChange
}: {
  label: string;
  strategies: GovernanceWorkflowCaseKind['approvalStrategies'];
  section: StrategySection;
  fields: Array<{ id: string; name: string; type: string }>;
  onChange: (patch: Partial<StrategySection>) => void;
}) => {
  const selectedId = section.strategy ?? strategies[0]?.id;
  const selected = strategies.find(strategy => strategy.id === selectedId);
  const fieldId = section.strategyConfig['fieldId'];

  return (
    <>
      <FormElement label={label}>
        <Select.Root
          value={selectedId}
          onChange={value => onChange({ strategy: value, strategyConfig: {} })}
          disabled={strategies.length === 1}
        >
          {strategies.map(strategy => (
            <Select.Item key={strategy.id} value={strategy.id}>
              {strategy.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      {selected?.configType === 'document-field' && (
        <FormElement label="Source field">
          <Select.Root
            value={typeof fieldId === 'string' ? fieldId : undefined}
            onChange={value => onChange({ strategyConfig: { fieldId: value } })}
            placeholder="Select a user or team field"
          >
            {fields.map(field => (
              <Select.Item key={field.id} value={field.id}>
                {field.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
      )}
    </>
  );
};

const WorkflowBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={styles.workflowBlock}>
    <div className={styles.workflowBlockTitle}>{title}</div>
    <div className={styles.workflowBlockFields}>{children}</div>
  </section>
);

const ConfigEditor = ({
  row,
  caseKind,
  workspaceSlug,
  onClose,
  onSave
}: {
  row: GovernanceWorkflowConfigRow | null;
  caseKind: GovernanceWorkflowCaseKind;
  workspaceSlug: string;
  onClose: () => void;
  onSave: (body: GovernanceWorkflowConfigUpsert) => void;
}) => {
  const [config, setConfig] = useState<GovernanceWorkflowConfig>(
    () => row?.config ?? defaultConfig(caseKind)
  );
  const [enabled, setEnabled] = useState(row?.enabled ?? true);
  const [tab, setTab] = useState(
    caseKind.supportsApprovals !== false
      ? 'approvals'
      : caseKind.supportsReminders !== false
        ? 'reminders'
        : 'escalation'
  );
  const statusValues = useMemo(
    () => documentStatusExtension(config).statusesRequiringApprovals,
    [config]
  );
  const { data: documentTypes = [] } = useDocumentTypes(
    workspaceSlug,
    caseKind.case_kind === 'document.status'
  );
  const [documentTypeId, fieldId] = row?.case_subkind?.split(':') ?? [];
  const enumField = documentTypes
    .find(type => type.id === documentTypeId)
    ?.fields.find(field => field.id === fieldId && field.type === 'enum');
  const documentTargetFields =
    documentTypes
      .find(type => type.id === documentTypeId)
      ?.fields.filter(
        field => (field.type === 'user_link' || field.type === 'team_link') && !field.retired
      ) ?? [];

  useEffect(() => {
    setConfig(row?.config ?? defaultConfig(caseKind));
    setEnabled(row?.enabled ?? true);
    setTab(
      caseKind.supportsApprovals !== false
        ? 'approvals'
        : caseKind.supportsReminders !== false
          ? 'reminders'
          : 'escalation'
    );
  }, [caseKind, row]);

  const update = (patch: Partial<GovernanceWorkflowConfig>) =>
    setConfig(current => ({
      ...current,
      ...patch,
      extensions: patch.extensions ?? current.extensions
    }));

  const approvals = config.approvals;
  const reminders = config.reminders;
  const escalation = config.escalation;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Configure workflow · ${caseKind.label}`}
      width={760}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: 'Save workflow',
          type: 'default',
          onClick: () =>
            onSave({
              case_kind: caseKind.case_kind,
              case_subkind: row?.case_subkind ?? null,
              enabled,
              config
            })
        }
      ]}
    >
      <div className={styles.workflowToggles}>
        <label className={styles.check}>
          <Checkbox value={enabled} onChange={checked => setEnabled(checked ?? false)} />
          Enable workflow
        </label>
        <label className={styles.check}>
          <Checkbox
            value={config.external ?? false}
            onChange={checked => update({ external: checked ?? false })}
          />
          External
        </label>
      </div>
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List aria-label="Workflow configuration sections">
          {caseKind.supportsApprovals !== false && (
            <Tabs.Trigger value="approvals">Approvals</Tabs.Trigger>
          )}
          {caseKind.supportsReminders !== false && (
            <Tabs.Trigger value="reminders">Reminders</Tabs.Trigger>
          )}
          {caseKind.supportsEscalation !== false && (
            <Tabs.Trigger value="escalation">Escalation</Tabs.Trigger>
          )}
          {caseKind.case_kind === 'document.status' && (
            <Tabs.Trigger value="values">Status values</Tabs.Trigger>
          )}
        </Tabs.List>
        {caseKind.supportsApprovals !== false && (
          <Tabs.Content value="approvals" style={{ height: 'auto' }}>
            <label className={styles.check}>
              <Checkbox
                value={approvals != null}
                onChange={checked =>
                  update({
                    approvals: checked
                      ? (approvals ?? {
                          requiredApprovals: 1,
                          strategy: caseKind.approvalStrategies[0]?.id,
                          strategyConfig: {},
                          fallbackUserIds: [],
                          fallbackTeamIds: []
                        })
                      : undefined
                  })
                }
              />
              Enable approval policy
            </label>
            {approvals && (
              <div className={styles.workflowBlocks}>
                <WorkflowBlock title="Approval requirement">
                  <FormElement label="Number of approvals required">
                    <TextInput
                      type="number"
                      value={String(approvals.requiredApprovals)}
                      onChange={value =>
                        update({
                          approvals: {
                            ...approvals,
                            requiredApprovals: Math.max(1, Number(value ?? 1))
                          }
                        })
                      }
                    />
                  </FormElement>
                </WorkflowBlock>
                <WorkflowBlock title="Approval strategy">
                  <StrategyEditor
                    label="Strategy"
                    strategies={caseKind.approvalStrategies}
                    section={approvals}
                    fields={documentTargetFields}
                    onChange={patch => update({ approvals: { ...approvals, ...patch } })}
                  />
                </WorkflowBlock>
                <WorkflowBlock title="Fallback approvers">
                  <FormElement label="Fallback users">
                    <FallbackTargetPicker
                      workspaceSlug={workspaceSlug}
                      kind="user"
                      values={approvals.fallbackUserIds}
                      onChange={fallbackUserIds =>
                        update({ approvals: { ...approvals, fallbackUserIds } })
                      }
                    />
                  </FormElement>
                  <FormElement label="Fallback teams">
                    <FallbackTargetPicker
                      workspaceSlug={workspaceSlug}
                      kind="team"
                      values={approvals.fallbackTeamIds}
                      onChange={fallbackTeamIds =>
                        update({ approvals: { ...approvals, fallbackTeamIds } })
                      }
                    />
                  </FormElement>
                </WorkflowBlock>
              </div>
            )}
          </Tabs.Content>
        )}
        {caseKind.supportsReminders !== false && (
          <Tabs.Content value="reminders" style={{ height: 'auto' }}>
            <label className={styles.check}>
              <Checkbox
                value={reminders?.enabled ?? false}
                onChange={checked =>
                  update({
                    reminders: {
                      enabled: checked ?? false,
                      approachingDays: reminders?.approachingDays ?? [],
                      overdueDays: reminders?.overdueDays ?? []
                    }
                  })
                }
              />
              Enable scheduled reminders
            </label>
            {reminders && (
              <div className={styles.formGrid}>
                <FormElement label="Approaching days">
                  <TextInput
                    value={reminders.approachingDays.join(', ')}
                    onChange={value =>
                      update({
                        reminders: { ...reminders, approachingDays: parseDays(value ?? '') }
                      })
                    }
                  />
                </FormElement>
                <FormElement label="Overdue days">
                  <TextInput
                    value={reminders.overdueDays.join(', ')}
                    onChange={value =>
                      update({ reminders: { ...reminders, overdueDays: parseDays(value ?? '') } })
                    }
                  />
                </FormElement>
              </div>
            )}
          </Tabs.Content>
        )}
        {caseKind.supportsEscalation !== false && (
          <Tabs.Content value="escalation" style={{ height: 'auto' }}>
            <label className={styles.check}>
              <Checkbox
                value={escalation?.enabled ?? false}
                onChange={checked =>
                  update({
                    escalation: {
                      enabled: checked ?? false,
                      overdueDays: escalation?.overdueDays ?? 5,
                      strategy: escalation?.strategy ?? caseKind.escalationStrategies[0]?.id,
                      strategyConfig: escalation?.strategyConfig ?? {},
                      fallbackUserIds: escalation?.fallbackUserIds ?? [],
                      fallbackTeamIds: escalation?.fallbackTeamIds ?? []
                    }
                  })
                }
              />
              Enable escalation
            </label>
            {escalation && (
              <div className={styles.workflowBlocks}>
                <WorkflowBlock title="Escalation timing">
                  <FormElement label="Escalate after overdue days">
                    <TextInput
                      type="number"
                      value={String(escalation.overdueDays)}
                      onChange={value =>
                        update({
                          escalation: {
                            ...escalation,
                            overdueDays: Math.max(1, Number(value ?? 1))
                          }
                        })
                      }
                    />
                  </FormElement>
                </WorkflowBlock>
                <WorkflowBlock title="Escalation strategy">
                  <StrategyEditor
                    label="Strategy"
                    strategies={caseKind.escalationStrategies}
                    section={escalation}
                    fields={documentTargetFields}
                    onChange={patch => update({ escalation: { ...escalation, ...patch } })}
                  />
                </WorkflowBlock>
                <WorkflowBlock title="Fallback escalation targets">
                  <FormElement label="Fallback users">
                    <FallbackTargetPicker
                      workspaceSlug={workspaceSlug}
                      kind="user"
                      values={escalation.fallbackUserIds}
                      onChange={fallbackUserIds =>
                        update({ escalation: { ...escalation, fallbackUserIds } })
                      }
                    />
                  </FormElement>
                  <FormElement label="Fallback teams">
                    <FallbackTargetPicker
                      workspaceSlug={workspaceSlug}
                      kind="team"
                      values={escalation.fallbackTeamIds}
                      onChange={fallbackTeamIds =>
                        update({ escalation: { ...escalation, fallbackTeamIds } })
                      }
                    />
                  </FormElement>
                  <div className={styles.hint}>
                    Workspace admins are used if no target resolves.
                  </div>
                </WorkflowBlock>
              </div>
            )}
          </Tabs.Content>
        )}
        {caseKind.case_kind === 'document.status' && (
          <Tabs.Content value="values" style={{ height: 'auto' }}>
            <div className={styles.statusValues}>
              <div className={styles.hint}>
                Select the enum values that require the shared approval policy.
              </div>
              {(enumField?.enumOptions ?? []).map(option => (
                <label className={styles.check} key={option.value}>
                  <Checkbox
                    value={statusValues.includes(option.value)}
                    onChange={checked => {
                      const next = checked
                        ? [...statusValues, option.value]
                        : statusValues.filter(value => value !== option.value);
                      update({
                        extensions: {
                          ...config.extensions,
                          'document.status': { statusesRequiringApprovals: next }
                        }
                      });
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </Tabs.Content>
        )}
      </Tabs.Root>
    </Dialog>
  );
};

export const WorkflowsSubSection = ({
  workspaceSlug,
  addDialogOpen,
  onCloseAddDialog
}: {
  workspaceSlug: string;
  addDialogOpen: boolean;
  onCloseAddDialog: () => void;
}) => {
  const { data, isLoading, isError } = useGovernanceWorkflowConfig(workspaceSlug);
  const upsert = useUpsertGovernanceWorkflowConfig(workspaceSlug);
  const reset = useResetGovernanceWorkflowConfig(workspaceSlug);
  const [editing, setEditing] = useState<GovernanceWorkflowConfigRow | null>(null);
  const [addingKind, setAddingKind] = useState<GovernanceWorkflowCaseKind | null>(null);
  const [newSubkind, setNewSubkind] = useState<string | null>(null);

  const kindById = useMemo(
    () => new Map((data?.case_kinds ?? []).map(kind => [kind.case_kind, kind])),
    [data?.case_kinds]
  );
  const configs = useMemo(
    () =>
      [...(data?.configs ?? [])].sort((left, right) => {
        const workflowOrder = left.case_kind_label.localeCompare(right.case_kind_label);
        if (workflowOrder !== 0) return workflowOrder;
        return (left.case_subkind_label ?? '').localeCompare(right.case_subkind_label ?? '');
      }),
    [data?.configs]
  );

  const closeAdd = () => {
    setAddingKind(null);
    setNewSubkind(null);
    onCloseAddDialog();
  };

  const subkindReady =
    addingKind?.supportsSubkind !== true ||
    (newSubkind != null &&
      (addingKind.case_kind === 'document.status' || addingKind.case_kind === 'field-date-reminder'
        ? newSubkind.split(':').every(Boolean)
        : true));
  const duplicateConfig =
    addingKind != null &&
    subkindReady &&
    (data?.configs ?? []).some(
      row =>
        row.case_kind === addingKind.case_kind &&
        row.case_subkind === (addingKind.supportsSubkind ? newSubkind : null)
    );

  useEffect(() => {
    if (!addDialogOpen) {
      setAddingKind(null);
      setNewSubkind(null);
      return;
    }
    setAddingKind(data?.case_kinds[0] ?? null);
  }, [addDialogOpen, data?.case_kinds]);

  return (
    <div className={styles.blockList}>
      {isLoading && <div className={styles.emptyNote}>Loading workflow configuration…</div>}
      {isError && <div className={styles.emptyNote}>Unable to load workflow configuration.</div>}
      {!isLoading && !isError && configs.length === 0 && (
        <div className={styles.emptyNote}>No workspace workflow overrides are configured.</div>
      )}
      {!isLoading && !isError && configs.length > 0 && (
        <Table.Root layout="fixed">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell width={260}>Workflow</Table.HeaderCell>
              <Table.HeaderCell width={220}>Scope</Table.HeaderCell>
              <Table.HeaderCell>Configuration</Table.HeaderCell>
              <Table.HeaderCell width={150}>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {configs.map(row => (
              <Table.Row key={row.id}>
                <Table.Cell>
                  <div className={styles.cardTitle}>{row.case_kind_label}</div>
                  <div className={styles.cardSub}>{row.case_kind_description}</div>
                </Table.Cell>
                <Table.Cell>{row.case_subkind_label ?? 'Workspace-wide'}</Table.Cell>
                <Table.Cell>
                  <div className={styles.configChips}>
                    {row.config.approvals && <Chip dot="var(--accent-fg)">Approvals</Chip>}
                    {row.config.reminders && (
                      <Chip
                        tone={row.config.reminders.enabled ? 'default' : 'ghost'}
                        dot={
                          row.config.reminders.enabled
                            ? 'var(--success-fg, #4caf78)'
                            : 'var(--cmp-fg-disabled)'
                        }
                      >
                        Reminders
                      </Chip>
                    )}
                    {row.config.escalation && (
                      <Chip
                        tone={row.config.escalation.enabled ? 'default' : 'ghost'}
                        dot={
                          row.config.escalation.enabled
                            ? 'var(--warning-fg, #d69e45)'
                            : 'var(--cmp-fg-disabled)'
                        }
                      >
                        Escalation
                      </Chip>
                    )}
                    {row.config.external && <Chip dot="var(--warning-fg, #d69e45)">External</Chip>}
                    {!row.config.approvals &&
                      !row.config.reminders &&
                      !row.config.escalation &&
                      !row.config.external && (
                      <span className={styles.summary}>None</span>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className={styles.actions}>
                    <Button variant="ghost" onClick={() => setEditing(row)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        reset.mutate({ case_kind: row.case_kind, case_subkind: row.case_subkind })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <Dialog
        open={addDialogOpen && addingKind != null}
        onClose={closeAdd}
        title="Add workflow configuration"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: closeAdd },
          {
            label: 'Continue',
            type: 'default',
            disabled: addingKind == null || !subkindReady || duplicateConfig,
            onClick: () => {
              if (!addingKind) return;
              setEditing({
                id: '',
                case_kind: addingKind.case_kind,
                case_kind_label: addingKind.label,
                case_kind_description: addingKind.description,
                case_subkind: addingKind.supportsSubkind ? newSubkind : null,
                case_subkind_label: null,
                enabled: true,
                config: defaultConfig(addingKind),
                updated_at: new Date().toISOString(),
                updated_by: null
              });
              closeAdd();
            }
          }
        ]}
      >
        <FormElement label="Workflow kind">
          <Select.Root
            value={addingKind?.case_kind}
            onChange={value => {
              const next = data?.case_kinds.find(kind => kind.case_kind === value) ?? null;
              setAddingKind(next);
              setNewSubkind(null);
            }}
          >
            {(data?.case_kinds ?? []).map(kind => (
              <Select.Item key={kind.case_kind} value={kind.case_kind}>
                {kind.label}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
        {addingKind?.supportsSubkind && (
          <div className={styles.scopeEditor}>
            <SubkindEditor
              workspaceSlug={workspaceSlug}
              caseKind={addingKind}
              value={newSubkind}
              onChange={setNewSubkind}
            />
          </div>
        )}
        {duplicateConfig && (
          <div className={styles.errorNote}>
            A configuration already exists for this workflow and scope.
          </div>
        )}
      </Dialog>

      {editing && (
        <ConfigEditor
          row={editing}
          caseKind={
            kindById.get(editing.case_kind) ?? {
              case_kind: editing.case_kind,
              label: editing.case_kind_label,
              description: editing.case_kind_description,
              supportsSubkind: editing.case_subkind != null,
              supportsWorkspaceScope: true,
              supportsApprovals: true,
              supportsReminders: true,
              supportsEscalation: true,
              approvalStrategies: [],
              escalationStrategies: [],
              defaultConfig: { extensions: {} }
            }
          }
          workspaceSlug={workspaceSlug}
          onClose={() => setEditing(null)}
          onSave={body => {
            upsert.mutate(body, { onSuccess: () => setEditing(null) });
          }}
        />
      )}
    </div>
  );
};
