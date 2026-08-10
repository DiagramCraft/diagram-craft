import { useEffect, useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { Table } from '../../../components/table/Table';
import { Chip } from '../../../components/Chip';
import type {
  GovernanceWorkflowCaseKind,
  GovernanceWorkflowConfigRow
} from '@arch-register/api-types/governanceWorkflowConfigContract';
import {
  useGovernanceWorkflowConfig,
  useResetGovernanceWorkflowConfig,
  useUpsertGovernanceWorkflowConfig
} from '../../../hooks/useGovernanceWorkflowConfig';
import { defaultWorkflowConfig } from './WorkflowConfigHelpers';
import { WorkflowConfigDialog } from './WorkflowConfigDialog';
import { WorkflowSubkindEditor } from './WorkflowSubkindEditor';
import styles from './WorkflowsSubSection.module.css';

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
                      !row.config.external && <span className={styles.summary}>None</span>}
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
                config: defaultWorkflowConfig(addingKind),
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
            <WorkflowSubkindEditor
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
        <WorkflowConfigDialog
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
              supportsInitiationFields: true,
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
