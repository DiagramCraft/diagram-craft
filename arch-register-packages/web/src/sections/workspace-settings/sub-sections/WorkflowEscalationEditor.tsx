import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { GovernanceWorkflowCaseKind } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceEscalationConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import { WorkflowFallbackTargetPicker } from './WorkflowFallbackTargetPicker';
import { StrategyEditor, WorkflowBlock } from './WorkflowEditorPrimitives';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowEscalationEditorProps = {
  workspaceSlug: string;
  caseKind: GovernanceWorkflowCaseKind;
  escalation: GovernanceEscalationConfig | undefined;
  fields: Array<{ id: string; name: string; type: string }>;
  onChange: (escalation: GovernanceEscalationConfig | undefined) => void;
};

export const WorkflowEscalationEditor = ({
  workspaceSlug,
  caseKind,
  escalation,
  fields,
  onChange
}: WorkflowEscalationEditorProps) => (
  <>
    <label className={styles.check}>
      <Checkbox
        value={escalation?.enabled ?? false}
        onChange={checked =>
          onChange({
            enabled: checked ?? false,
            overdueDays: escalation?.overdueDays ?? 5,
            strategy: escalation?.strategy ?? caseKind.escalationStrategies[0]?.id,
            strategyConfig: escalation?.strategyConfig ?? {},
            fallbackUserIds: escalation?.fallbackUserIds ?? [],
            fallbackTeamIds: escalation?.fallbackTeamIds ?? []
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
                onChange({
                  ...escalation,
                  overdueDays: Math.max(1, Number(value ?? 1))
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
            fields={fields}
            onChange={patch => onChange({ ...escalation, ...patch })}
          />
        </WorkflowBlock>
        <WorkflowBlock title="Fallback escalation targets">
          <FormElement label="Fallback users">
            <WorkflowFallbackTargetPicker
              workspaceSlug={workspaceSlug}
              kind="user"
              values={escalation.fallbackUserIds}
              onChange={fallbackUserIds => onChange({ ...escalation, fallbackUserIds })}
            />
          </FormElement>
          <FormElement label="Fallback teams">
            <WorkflowFallbackTargetPicker
              workspaceSlug={workspaceSlug}
              kind="team"
              values={escalation.fallbackTeamIds}
              onChange={fallbackTeamIds => onChange({ ...escalation, fallbackTeamIds })}
            />
          </FormElement>
          <div className={styles.hint}>Workspace admins are used if no target resolves.</div>
        </WorkflowBlock>
      </div>
    )}
  </>
);
