import { useEffect, useState } from 'react';
import { TbBolt, TbEdit, TbPlus, TbTrash } from 'react-icons/tb';
import type {
  AutomationAction,
  AutomationCondition,
  AutomationConditionOperator,
  AutomationRule,
  AutomationRuleTrigger
} from '@arch-register/api-types/automationRuleContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Table } from '../../../components/table/Table';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { formatDateTime } from '../../../utils/dateFormat';
import {
  useAutomationRuleOperations,
  useAutomationRuleRuns,
  useAutomationRules,
  type AutomationRuleInput
} from '../../../hooks/useAutomationRules';
import styles from './AutomationRulesSubSection.module.css';

type TriggerKind = AutomationRuleTrigger['kind'];
type ActionKind = AutomationAction['kind'];

const TRIGGER_LABELS: Record<TriggerKind, string> = {
  entity_created: 'Entity created',
  entity_deleted: 'Entity deleted',
  field_changed: 'Field changed',
  lifecycle_transition: 'Lifecycle transition'
};

const ACTION_LABELS: Record<ActionKind, string> = {
  create_audit_note: 'Create audit note',
  send_notification: 'Send notification',
  set_field_value: 'Set field value'
};

const OPERATOR_LABELS: Record<AutomationConditionOperator, string> = {
  equals: 'Equals',
  not_equals: 'Not equals',
  is_empty: 'Is empty',
  is_not_empty: 'Is not empty'
};

const describeTrigger = (trigger: AutomationRuleTrigger) => {
  if (trigger.kind === 'field_changed') return `Field changed: ${trigger.field}`;
  if (trigger.kind === 'lifecycle_transition') {
    const from = trigger.from ?? 'any';
    const to = trigger.to ?? 'any';
    return `Lifecycle ${from} → ${to}`;
  }
  return TRIGGER_LABELS[trigger.kind];
};

const describeAction = (action: AutomationAction) => ACTION_LABELS[action.kind];

const defaultTriggerFor = (kind: TriggerKind): AutomationRuleTrigger => {
  if (kind === 'field_changed') return { kind, field: '' };
  if (kind === 'lifecycle_transition') return { kind, from: undefined, to: undefined };
  return { kind };
};

const defaultActionFor = (kind: ActionKind): AutomationAction => {
  if (kind === 'create_audit_note') return { kind, note: '' };
  if (kind === 'send_notification') {
    return { kind, recipient: { kind: 'owner_team' }, message: '' };
  }
  return { kind, field: '', value: '' };
};

const ConditionRow = ({
  condition,
  onChange,
  onRemove
}: {
  condition: AutomationCondition;
  onChange: (next: AutomationCondition) => void;
  onRemove: () => void;
}) => (
  <div className={styles.row}>
    <TextInput
      value={condition.field}
      onChange={value => onChange({ ...condition, field: value ?? '' })}
      placeholder="Field (e.g. _lifecycle or a custom field id)"
    />
    <Select.Root
      value={condition.operator}
      onChange={value =>
        onChange({ ...condition, operator: (value as AutomationConditionOperator) ?? 'equals' })
      }
      style={{ width: 160 }}
    >
      {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
        <Select.Item key={value} value={value}>
          {label}
        </Select.Item>
      ))}
    </Select.Root>
    {(condition.operator === 'equals' || condition.operator === 'not_equals') && (
      <TextInput
        value={
          typeof condition.value === 'string' ? condition.value : String(condition.value ?? '')
        }
        onChange={value => onChange({ ...condition, value: value ?? '' })}
        placeholder="Value"
      />
    )}
    <Button variant="ghost" size="xs" icon={<TbTrash size={13} />} onClick={onRemove} />
  </div>
);

const ActionRow = ({
  action,
  schemas,
  onChange,
  onRemove
}: {
  action: AutomationAction;
  schemas: EntitySchema[];
  onChange: (next: AutomationAction) => void;
  onRemove: () => void;
}) => (
  <div className={styles.section}>
    <div className={styles.sectionHead}>
      <Select.Root
        value={action.kind}
        onChange={value => onChange(defaultActionFor((value as ActionKind) ?? 'create_audit_note'))}
        style={{ width: 220 }}
      >
        {Object.entries(ACTION_LABELS).map(([value, label]) => (
          <Select.Item key={value} value={value}>
            {label}
          </Select.Item>
        ))}
      </Select.Root>
      <Button variant="ghost" size="xs" icon={<TbTrash size={13} />} onClick={onRemove}>
        Remove
      </Button>
    </div>

    {action.kind === 'create_audit_note' && (
      <TextInput
        value={action.note}
        onChange={value => onChange({ ...action, note: value ?? '' })}
        placeholder="Note text"
      />
    )}

    {action.kind === 'send_notification' && (
      <>
        <Select.Root
          value={action.recipient.kind}
          onChange={value => {
            const kind = (value as 'user' | 'owner_team' | 'reference_owner') ?? 'owner_team';
            onChange({
              ...action,
              recipient:
                kind === 'user'
                  ? { kind: 'user', userId: '' }
                  : kind === 'reference_owner'
                    ? { kind: 'reference_owner', field: '' }
                    : { kind: 'owner_team' }
            });
          }}
          style={{ width: '100%' }}
        >
          <Select.Item value="owner_team">Entity owner team</Select.Item>
          <Select.Item value="user">Specific user</Select.Item>
          <Select.Item value="reference_owner">Owner of referenced entity</Select.Item>
        </Select.Root>
        {action.recipient.kind === 'user' && (
          <TextInput
            value={action.recipient.userId}
            onChange={value =>
              onChange({ ...action, recipient: { kind: 'user', userId: value ?? '' } })
            }
            placeholder="User id"
          />
        )}
        {action.recipient.kind === 'reference_owner' && (
          <TextInput
            value={action.recipient.field}
            onChange={value =>
              onChange({ ...action, recipient: { kind: 'reference_owner', field: value ?? '' } })
            }
            placeholder="Reference field id"
          />
        )}
        <TextInput
          value={action.message}
          onChange={value => onChange({ ...action, message: value ?? '' })}
          placeholder="Notification message"
        />
      </>
    )}

    {action.kind === 'set_field_value' && (
      <div className={styles.row}>
        <TextInput
          value={action.field}
          onChange={value => onChange({ ...action, field: value ?? '' })}
          placeholder="Field id"
        />
        <TextInput
          value={typeof action.value === 'string' ? action.value : String(action.value ?? '')}
          onChange={value => onChange({ ...action, value: value ?? '' })}
          placeholder="Value"
        />
      </div>
    )}
    {schemas.length === 0 && null}
  </div>
);

const EditorDialog = ({
  rule,
  schemas,
  lifecycleStates,
  pending,
  error,
  onClose,
  onSave
}: {
  rule: AutomationRule | 'new' | null;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  onSave: (input: AutomationRuleInput) => void;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaId, setSchemaId] = useState<string>('');
  const [trigger, setTrigger] = useState<AutomationRuleTrigger>({ kind: 'entity_created' });
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!rule) return;
    if (rule === 'new') {
      setName('');
      setDescription('');
      setSchemaId('');
      setTrigger({ kind: 'entity_created' });
      setConditions([]);
      setActions([{ kind: 'create_audit_note', note: '' }]);
      setEnabled(true);
    } else {
      setName(rule.name);
      setDescription(rule.description ?? '');
      setSchemaId(rule.schema_id ?? '');
      setTrigger(rule.trigger);
      setConditions(rule.conditions);
      setActions(rule.actions);
      setEnabled(rule.enabled);
    }
  }, [rule]);

  if (!rule) return null;

  const isValid =
    name.trim() !== '' &&
    actions.length > 0 &&
    (trigger.kind !== 'field_changed' || trigger.field.trim() !== '');

  return (
    <Dialog
      open
      onClose={onClose}
      title={rule === 'new' ? 'Create automation rule' : 'Edit automation rule'}
      width={620}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: pending ? 'Saving…' : 'Save rule',
          type: 'default',
          disabled: pending || !isValid,
          onClick: () =>
            onSave({
              name,
              description: description.trim() === '' ? null : description,
              schema_id: schemaId === '' ? null : schemaId,
              trigger,
              conditions,
              actions,
              enabled
            })
        }
      ]}
    >
      <div className={styles.form}>
        <FormElement label="Name">
          <TextInput value={name} onChange={value => setName(value ?? '')} />
        </FormElement>
        <FormElement label="Description">
          <TextInput value={description} onChange={value => setDescription(value ?? '')} />
        </FormElement>
        <FormElement label="Entity type">
          <Select.Root
            value={schemaId}
            onChange={value => setSchemaId(value ?? '')}
            style={{ width: '100%' }}
          >
            <Select.Item value="">All entity types</Select.Item>
            {schemas.map(schema => (
              <Select.Item key={schema.id} value={schema.id}>
                {schema.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>

        <FormElement label="Trigger">
          <Select.Root
            value={trigger.kind}
            onChange={value =>
              setTrigger(defaultTriggerFor((value as TriggerKind) ?? 'entity_created'))
            }
            style={{ width: '100%' }}
          >
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <Select.Item key={value} value={value}>
                {label}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>

        {trigger.kind === 'field_changed' && (
          <FormElement label="Field id">
            <TextInput
              value={trigger.field}
              onChange={value => setTrigger({ kind: 'field_changed', field: value ?? '' })}
              placeholder="e.g. _owner, or a custom field id"
            />
          </FormElement>
        )}

        {trigger.kind === 'lifecycle_transition' && (
          <div className={styles.row}>
            <FormElement label="From (any if unset)">
              <Select.Root
                value={trigger.from ?? ''}
                onChange={value =>
                  setTrigger({
                    kind: 'lifecycle_transition',
                    from: value === '' ? undefined : (value ?? undefined),
                    to: trigger.to
                  })
                }
                style={{ width: '100%' }}
              >
                <Select.Item value="">Any</Select.Item>
                {lifecycleStates.map(state => (
                  <Select.Item key={state.id} value={state.id}>
                    {state.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
            <FormElement label="To (any if unset)">
              <Select.Root
                value={trigger.to ?? ''}
                onChange={value =>
                  setTrigger({
                    kind: 'lifecycle_transition',
                    from: trigger.from,
                    to: value === '' ? undefined : (value ?? undefined)
                  })
                }
                style={{ width: '100%' }}
              >
                <Select.Item value="">Any</Select.Item>
                {lifecycleStates.map(state => (
                  <Select.Item key={state.id} value={state.id}>
                    {state.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.label}>Conditions (all must match)</span>
          <div className={styles.rowList}>
            {conditions.map((condition, index) => (
              <ConditionRow
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                condition={condition}
                onChange={next => setConditions(conditions.map((c, i) => (i === index ? next : c)))}
                onRemove={() => setConditions(conditions.filter((_, i) => i !== index))}
              />
            ))}
          </div>
          <Button
            variant="secondary"
            size="xs"
            icon={<TbPlus size={12} />}
            onClick={() =>
              setConditions([...conditions, { field: '', operator: 'equals', value: '' }])
            }
          >
            Add condition
          </Button>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Actions</span>
          <div className={styles.rowList}>
            {actions.map((action, index) => (
              <ActionRow
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                action={action}
                schemas={schemas}
                onChange={next => setActions(actions.map((a, i) => (i === index ? next : a)))}
                onRemove={() => setActions(actions.filter((_, i) => i !== index))}
              />
            ))}
          </div>
          <Button
            variant="secondary"
            size="xs"
            icon={<TbPlus size={12} />}
            onClick={() => setActions([...actions, defaultActionFor('create_audit_note')])}
          >
            Add action
          </Button>
        </div>

        <label className={styles.check}>
          <Checkbox value={enabled} onChange={value => setEnabled(value ?? false)} /> Enabled
        </label>

        {error && <div className={styles.error}>{error.message}</div>}
      </div>
    </Dialog>
  );
};

type AutomationTab = 'rules' | 'runs';

const formatSummary = (result: Record<string, unknown> | null, error: string | null) => {
  if (error) return error;
  if (result == null) return '—';
  return JSON.stringify(result);
};

export const AutomationRulesSubSection = ({
  workspaceSlug,
  schemas,
  lifecycleStates
}: {
  workspaceSlug: string;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
}) => {
  const [tab, setTab] = useState<AutomationTab>('rules');
  const { data: rules = [], isLoading, error } = useAutomationRules(workspaceSlug);
  const operations = useAutomationRuleOperations(workspaceSlug);
  const [editor, setEditor] = useState<AutomationRule | 'new' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    data: runs,
    isLoading: runsLoading,
    isError: runsError
  } = useAutomationRuleRuns(workspaceSlug, { limit: 50, offset: 0 }, tab === 'runs');

  const save = async (input: AutomationRuleInput) => {
    if (editor === 'new') {
      await operations.create.mutateAsync(input);
    } else if (editor) {
      await operations.update.mutateAsync({ id: editor.id, ...input });
    }
    setEditor(null);
  };

  return (
    <div className={styles.container}>
      <Tabs.Root value={tab} onValueChange={v => setTab(v as AutomationTab)}>
        <Tabs.List>
          <Tabs.Trigger value="rules">Rules ({rules.length})</Tabs.Trigger>
          <Tabs.Trigger value="runs">Runs</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {tab === 'rules' && (
        <>
          <div className={styles.intro}>
            <span>
              Rules are matched synchronously when entities change; their actions run asynchronously
              on the job server.
            </span>
            <Button variant="primary" icon={<TbPlus size={13} />} onClick={() => setEditor('new')}>
              New rule
            </Button>
          </div>
          {error ? (
            <div className={styles.error}>Automation rules could not be loaded.</div>
          ) : isLoading ? (
            <LoadingState text="Loading automation rules…" size="sm" />
          ) : rules.length === 0 ? (
            <EmptyState
              icon={<TbBolt size={20} />}
              title="No automation rules"
              subtitle="Create a rule to act automatically when entities change."
            />
          ) : (
            <div className={styles.tableWrap}>
              <Table.Root>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Entity type</Table.HeaderCell>
                    <Table.HeaderCell>Trigger</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                    <Table.HeaderCell width={90}>State</Table.HeaderCell>
                    <Table.HeaderCell />
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {rules.map(rule => (
                    <Table.Row key={rule.id}>
                      <Table.Cell>
                        <div>{rule.name}</div>
                        {rule.description && <div className={styles.muted}>{rule.description}</div>}
                      </Table.Cell>
                      <Table.Cell>
                        {schemas.find(schema => schema.id === rule.schema_id)?.name ?? 'All'}
                      </Table.Cell>
                      <Table.Cell>{describeTrigger(rule.trigger)}</Table.Cell>
                      <Table.Cell>{rule.actions.map(describeAction).join(', ')}</Table.Cell>
                      <Table.Cell>
                        <Chip
                          dot={rule.enabled ? 'var(--green)' : 'var(--cmp-fg-disabled)'}
                          tone="ghost"
                        >
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Chip>
                      </Table.Cell>
                      <Table.ActionsCell>
                        <DropdownMenu
                          trigger={<Table.DotsButton aria-label={`Actions for ${rule.name}`} />}
                          items={
                            [
                              {
                                label: 'Edit',
                                icon: <TbEdit size={14} />,
                                onClick: () => setEditor(rule)
                              },
                              {
                                label: 'Delete',
                                icon: <TbTrash size={14} />,
                                danger: true,
                                onClick: () => setDeleteId(rule.id)
                              }
                            ] satisfies MenuItem[]
                          }
                        />
                      </Table.ActionsCell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </div>
          )}
        </>
      )}

      {tab === 'runs' &&
        (runsLoading ? (
          <LoadingState text="Loading rule runs…" size="sm" />
        ) : runsError ? (
          <div className={styles.error}>Rule runs could not be loaded.</div>
        ) : runs == null || runs.items.length === 0 ? (
          <EmptyState compact title="No automation rule runs yet." />
        ) : (
          <div className={styles.tableWrap}>
            <Table.Root layout="fixed" bordered={false}>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell width={155}>Planned</Table.HeaderCell>
                  <Table.HeaderCell width={155}>Completed</Table.HeaderCell>
                  <Table.HeaderCell width={100}>Status</Table.HeaderCell>
                  <Table.HeaderCell width={90}>Attempts</Table.HeaderCell>
                  <Table.HeaderCell>Result / error</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {runs.items.map(run => (
                  <Table.Row key={run.id}>
                    <Table.Cell>{formatDateTime(run.planned_at)}</Table.Cell>
                    <Table.Cell>{formatDateTime(run.completed_at)}</Table.Cell>
                    <Table.Cell>
                      <Chip
                        dot={
                          run.status === 'succeeded'
                            ? 'var(--green)'
                            : run.status === 'failed'
                              ? 'var(--error-fg)'
                              : 'var(--warning-fg)'
                        }
                        tone="ghost"
                      >
                        {run.status}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell numeric>
                      {run.attempt_count}/{run.max_attempts}
                    </Table.Cell>
                    <Table.Cell>
                      <div className={styles.summary}>{formatSummary(run.result, run.error)}</div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </div>
        ))}

      <EditorDialog
        rule={editor}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        pending={operations.create.isPending || operations.update.isPending}
        error={(operations.create.error ?? operations.update.error) as Error | null}
        onClose={() => setEditor(null)}
        onSave={input => void save(input)}
      />
      <DeleteConfirmationDialog
        open={deleteId != null}
        title="Delete automation rule?"
        message="Queued runs for this rule will still execute, but no new runs will be enqueued."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void operations.remove.mutateAsync(deleteId).then(() => setDeleteId(null));
        }}
      />
    </div>
  );
};
