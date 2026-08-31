import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { GovernanceWorkflowCaseKind } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceApprovalConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import { WorkflowFallbackTargetPicker } from './WorkflowFallbackTargetPicker';
import { StrategyEditor, WorkflowBlock } from './WorkflowEditorPrimitives';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowApprovalEditorProps = {
  workspaceSlug: string;
  caseKind: GovernanceWorkflowCaseKind;
  approvals: GovernanceApprovalConfig | undefined;
  fields: Array<{ id: string; name: string; type: string }>;
  onChange: (approvals: GovernanceApprovalConfig | undefined) => void;
  /** 'approval' shows the approval-count block; 'routing' is for acknowledge-only case kinds. */
  variant?: 'approval' | 'routing';
};

export const WorkflowApprovalEditor = ({
  workspaceSlug,
  caseKind,
  approvals,
  fields,
  onChange,
  variant = 'approval'
}: WorkflowApprovalEditorProps) => {
  const routing = variant === 'routing';
  return (
    <>
      <label className={styles.check}>
        <Checkbox
          value={approvals != null}
          onChange={checked =>
            onChange(
              checked
                ? (approvals ?? {
                    requiredApprovals: 1,
                    strategy: caseKind.approvalStrategies[0]?.id,
                    strategyConfig: {},
                    fallbackUserIds: [],
                    fallbackTeamIds: []
                  })
                : undefined
            )
          }
        />
        {routing ? 'Configure assignment routing' : 'Enable approval policy'}
      </label>
      {approvals && (
        <div className={styles.workflowBlocks}>
          {!routing && (
            <WorkflowBlock title="Approval requirement">
              <FormElement label="Number of approvals required">
                <TextInput
                  type="number"
                  value={String(approvals.requiredApprovals)}
                  onChange={value =>
                    onChange({
                      ...approvals,
                      requiredApprovals: Math.max(1, Number(value ?? 1))
                    })
                  }
                />
              </FormElement>
            </WorkflowBlock>
          )}
          <WorkflowBlock title={routing ? 'Assign to' : 'Approval strategy'}>
            <StrategyEditor
              label="Strategy"
              strategies={caseKind.approvalStrategies}
              section={approvals}
              fields={fields}
              onChange={patch => onChange({ ...approvals, ...patch })}
            />
          </WorkflowBlock>
          <WorkflowBlock title={routing ? 'Fallback assignees' : 'Fallback approvers'}>
            <FormElement label="Fallback users">
              <WorkflowFallbackTargetPicker
                workspaceSlug={workspaceSlug}
                kind="user"
                values={approvals.fallbackUserIds}
                onChange={fallbackUserIds => onChange({ ...approvals, fallbackUserIds })}
              />
            </FormElement>
            <FormElement label="Fallback teams">
              <WorkflowFallbackTargetPicker
                workspaceSlug={workspaceSlug}
                kind="team"
                values={approvals.fallbackTeamIds}
                onChange={fallbackTeamIds => onChange({ ...approvals, fallbackTeamIds })}
              />
            </FormElement>
          </WorkflowBlock>
        </div>
      )}
    </>
  );
};
