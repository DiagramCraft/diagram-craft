import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import styles from './WorkflowsSubSection.module.css';
import { useGovernanceWorkflowOverview } from '../../../hooks/useGovernanceWorkflowOverview';
import {
  useGovernanceReminderConfig,
  useUpdateGovernanceReminderConfig
} from '../../../hooks/useGovernanceReminderConfig';
import { ReminderConfigRow } from './ReminderConfigRow';
import { settingsSectionTarget } from '../../../routes/settingsNavigation';
import type { GovernanceWorkflowOverview } from '@arch-register/api-types/governanceWorkflowOverviewContract';
import type { GovernanceReminderConfig } from '@arch-register/api-types/governanceReminderConfigContract';

type ReminderConfigSave = {
  enabled: boolean;
  approaching_days: number[];
  overdue_days: number[];
  escalation_enabled: boolean;
};

const WorkflowCard = ({
  workflow,
  workspaceSlug,
  reminderConfigByCaseKind,
  savingReminderConfig,
  onSaveReminderConfig
}: {
  workflow: GovernanceWorkflowOverview;
  workspaceSlug: string;
  reminderConfigByCaseKind: Map<string, GovernanceReminderConfig>;
  savingReminderConfig: boolean;
  onSaveReminderConfig: (caseKind: string, data: ReminderConfigSave) => void;
}) => {
  const navigate = useNavigate();
  const reminderConfig = reminderConfigByCaseKind.get(workflow.case_kind);
  const configuredElsewhere = workflow.configured_elsewhere;

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <div className={styles.cardTitle}>{workflow.label}</div>
          <div className={styles.cardSub}>{workflow.description}</div>
        </div>
        <div className={styles.badges}>
          {workflow.capabilities.reminders && (
            <span className={`${styles.badge} ${styles.badgeActive}`}>Reminders</span>
          )}
          {workflow.capabilities.escalation && (
            <span className={`${styles.badge} ${styles.badgeActive}`}>Escalation</span>
          )}
          {workflow.capabilities.approvalQuorum && (
            <span className={`${styles.badge} ${styles.badgeActive}`}>Approval & quorum</span>
          )}
        </div>
      </div>
      <div className={styles.cardBody}>
        {workflow.capabilities.reminders && reminderConfig && (
          <ReminderConfigRow
            config={reminderConfig}
            saving={savingReminderConfig}
            onSave={data => onSaveReminderConfig(workflow.case_kind, data)}
          />
        )}
        {workflow.capabilities.approvalQuorum && (
          <div className={styles.approvalSummary}>
            <span>
              {workflow.approval_summary?.documentTypesConfigured ?? 0} document type(s) with{' '}
              {workflow.approval_summary?.fieldsConfigured ?? 0} workflow-enabled field(s)
            </span>
            <Button onClick={() => navigate(settingsSectionTarget(workspaceSlug, 'documents'))}>
              Configure in Document Schema
            </Button>
          </div>
        )}
        {!workflow.capabilities.reminders &&
          !workflow.capabilities.approvalQuorum &&
          (configuredElsewhere ? (
            <div className={styles.approvalSummary}>
              <span>Configured per {configuredElsewhere.settings_section_label} field.</span>
              <Button
                onClick={() =>
                  navigate(
                    settingsSectionTarget(workspaceSlug, configuredElsewhere.settings_section_id)
                  )
                }
              >
                Configure in {configuredElsewhere.settings_section_label}
              </Button>
            </div>
          ) : (
            <div className={styles.emptyNote}>No configurable workflow settings yet.</div>
          ))}
      </div>
    </div>
  );
};

export const WorkflowsSubSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const { data: workflows } = useGovernanceWorkflowOverview(workspaceSlug);
  const { data: reminderConfigs } = useGovernanceReminderConfig(workspaceSlug);
  const updateReminderConfig = useUpdateGovernanceReminderConfig(workspaceSlug);

  const reminderConfigByCaseKind = new Map(
    (reminderConfigs ?? []).map(config => [config.case_kind, config])
  );

  return (
    <div className={styles.blockList}>
      <div className={styles.intro}>
        Overview of every governance workflow in this workspace. Some settings shown here can also
        be edited from their own settings screen (e.g. Document Schema).
      </div>
      {(workflows ?? []).map(workflow => (
        <WorkflowCard
          key={workflow.case_kind}
          workflow={workflow}
          workspaceSlug={workspaceSlug}
          reminderConfigByCaseKind={reminderConfigByCaseKind}
          savingReminderConfig={updateReminderConfig.isPending}
          onSaveReminderConfig={(caseKind, data) => updateReminderConfig.mutate({ caseKind, data })}
        />
      ))}
    </div>
  );
};
