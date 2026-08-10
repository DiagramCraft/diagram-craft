import { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type {
  GovernanceWorkflowConfigRow,
  GovernanceWorkflowConfigUpsert,
  GovernanceWorkflowCaseKind
} from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import { useDocumentTypes } from '../../../hooks/useDocuments';
import { WorkflowApprovalEditor } from './WorkflowApprovalEditor';
import { documentStatusExtension, defaultWorkflowConfig } from './WorkflowConfigHelpers';
import { WorkflowEscalationEditor } from './WorkflowEscalationEditor';
import { WorkflowInitiationFieldsEditor } from './WorkflowInitiationFieldsEditor';
import { WorkflowReminderEditor } from './WorkflowReminderEditor';
import { WorkflowStatusValuesEditor } from './WorkflowStatusValuesEditor';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowConfigDialogProps = {
  row: GovernanceWorkflowConfigRow | null;
  caseKind: GovernanceWorkflowCaseKind;
  workspaceSlug: string;
  onClose: () => void;
  onSave: (body: GovernanceWorkflowConfigUpsert) => void;
};

export const WorkflowConfigDialog = ({
  row,
  caseKind,
  workspaceSlug,
  onClose,
  onSave
}: WorkflowConfigDialogProps) => {
  const [config, setConfig] = useState<GovernanceWorkflowConfig>(
    () => row?.config ?? defaultWorkflowConfig(caseKind)
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
    setConfig(row?.config ?? defaultWorkflowConfig(caseKind));
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
          {caseKind.supportsInitiationFields !== false && (
            <Tabs.Trigger value="initiation-fields">Initiation fields</Tabs.Trigger>
          )}
          {caseKind.case_kind === 'document.status' && (
            <Tabs.Trigger value="values">Status values</Tabs.Trigger>
          )}
        </Tabs.List>
        {caseKind.supportsApprovals !== false && (
          <Tabs.Content value="approvals" style={{ height: 'auto' }}>
            <WorkflowApprovalEditor
              workspaceSlug={workspaceSlug}
              caseKind={caseKind}
              approvals={config.approvals}
              fields={documentTargetFields}
              onChange={approvals => update({ approvals })}
            />
          </Tabs.Content>
        )}
        {caseKind.supportsReminders !== false && (
          <Tabs.Content value="reminders" style={{ height: 'auto' }}>
            <WorkflowReminderEditor
              reminders={config.reminders}
              onChange={reminders => update({ reminders })}
            />
          </Tabs.Content>
        )}
        {caseKind.supportsEscalation !== false && (
          <Tabs.Content value="escalation" style={{ height: 'auto' }}>
            <WorkflowEscalationEditor
              workspaceSlug={workspaceSlug}
              caseKind={caseKind}
              escalation={config.escalation}
              fields={documentTargetFields}
              onChange={escalation => update({ escalation })}
            />
          </Tabs.Content>
        )}
        {caseKind.supportsInitiationFields !== false && (
          <Tabs.Content value="initiation-fields" style={{ height: 'auto' }}>
            <WorkflowInitiationFieldsEditor
              workspaceSlug={workspaceSlug}
              fields={config.initiationFields ?? []}
              onChange={initiationFields => update({ initiationFields })}
            />
          </Tabs.Content>
        )}
        {caseKind.case_kind === 'document.status' && (
          <Tabs.Content value="values" style={{ height: 'auto' }}>
            <WorkflowStatusValuesEditor
              options={enumField?.enumOptions ?? []}
              statusValues={statusValues}
              onChange={next =>
                update({
                  extensions: {
                    ...config.extensions,
                    'document.status': { statusesRequiringApprovals: next }
                  }
                })
              }
            />
          </Tabs.Content>
        )}
      </Tabs.Root>
    </Dialog>
  );
};
