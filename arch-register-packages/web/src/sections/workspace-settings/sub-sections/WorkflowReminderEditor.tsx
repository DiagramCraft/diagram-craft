import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { GovernanceReminderConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import { parseDays } from './WorkflowConfigHelpers';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowReminderEditorProps = {
  reminders: GovernanceReminderConfig | undefined;
  onChange: (reminders: GovernanceReminderConfig | undefined) => void;
};

export const WorkflowReminderEditor = ({ reminders, onChange }: WorkflowReminderEditorProps) => (
  <>
    <label className={styles.check}>
      <Checkbox
        value={reminders?.enabled ?? false}
        onChange={checked =>
          onChange({
            enabled: checked ?? false,
            approachingDays: reminders?.approachingDays ?? [],
            overdueDays: reminders?.overdueDays ?? []
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
            onChange={value => onChange({ ...reminders, approachingDays: parseDays(value ?? '') })}
          />
        </FormElement>
        <FormElement label="Overdue days">
          <TextInput
            value={reminders.overdueDays.join(', ')}
            onChange={value => onChange({ ...reminders, overdueDays: parseDays(value ?? '') })}
          />
        </FormElement>
      </div>
    )}
  </>
);
